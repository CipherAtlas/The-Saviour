import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  CHARACTERS,
  FLOOR_PROJECTION_IDS,
  NARRATIVE_SEQUENCES,
  UPGRADE_SEQUENCE_IDS,
  floorProjectionId,
  upgradeSequenceId,
} from "../src/game/dialogueContent.js";
import {
  CHARACTER_ART_ASSETS,
  CHARACTER_ART_STATE_IDS,
  NARRATIVE_BACKGROUND_ASSETS,
  NARRATIVE_BACKGROUND_IDS,
} from "../src/game/narrativeAssetManifest.js";
import {
  GLOSSARY_ENTRIES,
  GLOSSARY_UNLOCK_NOTIFICATION,
} from "../src/game/glossaryContent.js";

const EXPECTED_CORPUS_HASH = "0a8380a299c8db5fbab1c7a1f292ad60f066ce53f40de357f6468bbe639b898f";
const EXPECTED_DIALOGUE_HASH = "0daac5dbaa3186969bf75d7cfc49c80a35556d2372b13cc00fd5e296e8361c98";

const EXPECTED_SEQUENCE_TOTALS = Object.freeze(Object.fromEntries([
  ["opening.domestic", 21, 315],
  ["opening.ring", 11, 106],
  ["opening.threshold", 12, 123],
  ["floor.f01.witch", 5, 62],
  ["floor.f01.upgrade.r01", 7, 100],
  ["floor.f01.upgrade.r02", 6, 79],
  ["floor.f01.upgrade.threshold", 6, 82],
  ["floor.f02.witch", 5, 75],
  ["floor.f02.upgrade.r01", 6, 77],
  ["floor.f02.upgrade.r02", 6, 77],
  ["floor.f02.upgrade.threshold", 6, 69],
  ["floor.f03.witch", 5, 80],
  ["floor.f03.upgrade.r01", 6, 84],
  ["floor.f03.upgrade.r02", 6, 79],
  ["floor.f03.upgrade.threshold", 6, 76],
  ["floor.f04.witch", 5, 50],
  ["floor.f04.upgrade.r01", 6, 70],
  ["floor.f04.upgrade.r02", 6, 77],
  ["floor.f04.upgrade.threshold", 6, 57],
  ["floor.f05.witch", 6, 80],
  ["floor.f05.upgrade.r01", 6, 65],
  ["floor.f05.upgrade.r02", 6, 86],
  ["floor.f05.upgrade.threshold", 6, 86],
  ["floor.f06.witch", 6, 72],
  ["floor.f06.upgrade.r01", 7, 87],
  ["floor.f06.upgrade.r02", 6, 85],
  ["floor.f06.upgrade.threshold", 6, 62],
  ["floor.f07.witch", 6, 82],
  ["floor.f07.upgrade.r01", 6, 79],
  ["floor.f07.upgrade.r02", 6, 84],
  ["floor.f07.upgrade.threshold", 6, 90],
  ["floor.f08.witch", 6, 75],
  ["floor.f08.upgrade.r01", 7, 65],
  ["floor.f08.upgrade.r02", 8, 89],
  ["floor.f08.upgrade.threshold", 6, 75],
  ["floor.f09.witch", 6, 95],
  ["floor.f09.upgrade.r01", 7, 94],
  ["floor.f09.upgrade.r02", 7, 81],
  ["floor.f09.upgrade.threshold", 6, 90],
  ["floor.f10.witch", 8, 118],
  ["floor.f10.upgrade.r01", 6, 67],
  ["floor.f10.upgrade.r02", 7, 91],
  ["boss.confrontation", 10, 165],
  ["ending.witch-death", 7, 81],
  ["ending.princess-reveal", 8, 119],
  ["ending.princess-human", 9, 149],
  ["ending.kill", 9, 87],
  ["ending.timeout", 7, 73],
  ["ending.timeout-final", 5, 43],
].map(([id, beats, words]) => [id, Object.freeze({ beats, words })])));

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function wordCount(beats) {
  return beats.reduce(
    (total, beat) => total + beat.text.split(/\s+/).filter(Boolean).length,
    0,
  );
}

function summarize(sequences) {
  const beats = sequences.flatMap((sequence) => sequence.beats);
  return {
    sequences: sequences.length,
    beats: beats.length,
    words: wordCount(beats),
  };
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("narrative registries cover the approved forty-nine sequence structure", () => {
  assert.equal(FLOOR_PROJECTION_IDS.length, 10);
  assert.deepEqual(
    FLOOR_PROJECTION_IDS,
    Array.from({ length: 10 }, (_unused, index) => "floor.f" + String(index + 1).padStart(2, "0") + ".witch"),
  );

  assert.equal(UPGRADE_SEQUENCE_IDS.length, 29);
  assert.equal(new Set(UPGRADE_SEQUENCE_IDS).size, 29);
  assert.equal(upgradeSequenceId(1, 1), "floor.f01.upgrade.r01");
  assert.equal(upgradeSequenceId(1, 2), "floor.f01.upgrade.r02");
  assert.equal(upgradeSequenceId(1, 3), "floor.f01.upgrade.threshold");
  assert.equal(upgradeSequenceId(10, 2), "floor.f10.upgrade.r02");
  assert.throws(() => upgradeSequenceId(10, 3), /boss encounter/i);
  assert.throws(() => floorProjectionId(0), /floor/i);

  assert.equal(Object.keys(NARRATIVE_SEQUENCES).length, 49);
  assert.ok(NARRATIVE_SEQUENCES["opening.domestic"]);
  for (const id of [...FLOOR_PROJECTION_IDS, ...UPGRADE_SEQUENCE_IDS]) {
    assert.ok(NARRATIVE_SEQUENCES[id], "Missing registered sequence: " + id);
  }
});

test("the runtime registry exactly matches approved per-sequence and route totals", () => {
  assert.deepEqual(Object.keys(NARRATIVE_SEQUENCES), Object.keys(EXPECTED_SEQUENCE_TOTALS));

  for (const [id, expected] of Object.entries(EXPECTED_SEQUENCE_TOTALS)) {
    const sequence = NARRATIVE_SEQUENCES[id];
    assert.equal(sequence.beats.length, expected.beats, id + " beat count");
    assert.equal(wordCount(sequence.beats), expected.words, id + " word count");
  }

  const sequences = Object.values(NARRATIVE_SEQUENCES);
  assert.deepEqual(summarize(sequences), { sequences: 49, beats: 339, words: 4353 });

  const opening = sequences.filter((sequence) => sequence.id.startsWith("opening."));
  const projections = sequences.filter((sequence) => /^floor\.f\d{2}\.witch$/.test(sequence.id));
  const upgrades = sequences.filter((sequence) => /^floor\.f\d{2}\.upgrade\./.test(sequence.id));
  const boss = sequences.filter((sequence) => sequence.id === "boss.confrontation");
  const endings = sequences.filter((sequence) => sequence.id.startsWith("ending."));
  assert.deepEqual(summarize(opening), { sequences: 3, beats: 44, words: 544 });
  assert.deepEqual(summarize(projections), { sequences: 10, beats: 58, words: 789 });
  assert.deepEqual(summarize(upgrades), { sequences: 29, beats: 182, words: 2303 });
  assert.deepEqual(summarize(boss), { sequences: 1, beats: 10, words: 165 });
  assert.deepEqual(summarize(endings), { sequences: 6, beats: 45, words: 552 });

  const killRoute = sequences.filter((sequence) => (
    sequence.id !== "ending.timeout" && sequence.id !== "ending.timeout-final"
  ));
  const timeoutRoute = sequences.filter((sequence) => sequence.id !== "ending.kill");
  assert.deepEqual(summarize(killRoute), { sequences: 47, beats: 327, words: 4237 });
  assert.deepEqual(summarize(timeoutRoute), { sequences: 48, beats: 330, words: 4266 });
});

test("approved dialogue words and metadata have the canonical hashes", () => {
  const corpus = Object.values(NARRATIVE_SEQUENCES).map((sequence) => ({
    id: sequence.id,
    beats: sequence.beats.map((beat) => ({
      id: beat.id,
      speaker: CHARACTERS[beat.speaker].name,
      expression: beat.expression,
      pose: beat.pose,
      stage: beat.stage,
      background: beat.background,
      text: beat.text,
    })),
  }));
  const displayedLines = corpus.flatMap((sequence) => sequence.beats.map((beat) => beat.text)).join("\n");

  assert.equal(hash(JSON.stringify(corpus)), EXPECTED_CORPUS_HASH);
  assert.equal(hash(displayedLines), EXPECTED_DIALOGUE_HASH);
});

test("every sequence and beat has valid explicit immutable VN metadata", () => {
  const validSpeakers = new Set(Object.keys(CHARACTERS));
  const validStages = new Set(["left", "center-left", "center", "right"]);
  const validRoles = new Set([
    "domestic",
    "ringPursuit",
    "threshold",
    "floorProjection",
    "upgradeEncounter",
    "bossConfrontation",
    "witchDeath",
    "princessReveal",
    "princessHuman",
    "endingKill",
    "endingTimeout",
    "endingTimeoutFinal",
  ]);
  const sequenceIds = new Set();
  const beatIds = new Set();
  const textCounts = new Map();

  for (const [key, sequence] of Object.entries(NARRATIVE_SEQUENCES)) {
    assert.equal(sequence.id, key);
    assert.equal(sequenceIds.has(sequence.id), false, "Duplicate sequence ID: " + sequence.id);
    sequenceIds.add(sequence.id);
    assert.equal(sequence.presentation, "vn");
    assert.equal(validRoles.has(sequence.sceneRole), true, "Unknown role: " + sequence.sceneRole);
    assert.equal(sequence.repeat, UPGRADE_SEQUENCE_IDS.includes(key) ? "perOffer" : "oncePerRun");
    assert.ok(sequence.beats.length > 0);

    for (const beat of sequence.beats) {
      assert.equal(beatIds.has(beat.id), false, "Duplicate beat ID: " + beat.id);
      beatIds.add(beat.id);
      assert.equal(validSpeakers.has(beat.speaker), true, "Unknown speaker: " + beat.speaker);
      assert.equal(beat.text.trim().length > 0, true, "Empty text: " + beat.id);
      assert.equal(beat.expression.trim().length > 0, true, "Missing expression: " + beat.id);
      assert.equal(beat.pose.trim().length > 0, true, "Missing pose: " + beat.id);
      assert.equal(validStages.has(beat.stage), true, "Invalid stage: " + beat.id);
      assert.ok(NARRATIVE_BACKGROUND_ASSETS[beat.background], "Unknown background: " + beat.background);
      const artAsset = CHARACTER_ART_ASSETS[beat.artState];
      assert.ok(artAsset, "Unknown art state: " + beat.artState);
      assert.equal(artAsset.characterId, beat.speaker, "Art/speaker mismatch: " + beat.id);
      textCounts.set(beat.text, (textCounts.get(beat.text) ?? 0) + 1);
    }
  }

  assert.equal(sequenceIds.size, 49);
  assert.equal(beatIds.size, 339);
  assert.deepEqual(
    [...new Set(Object.values(NARRATIVE_SEQUENCES).flatMap((sequence) => sequence.beats.map((beat) => beat.artState)))].sort(),
    [...CHARACTER_ART_STATE_IDS].sort(),
  );
  assert.deepEqual(
    [...new Set(Object.values(NARRATIVE_SEQUENCES).flatMap((sequence) => sequence.beats.map((beat) => beat.background)))].sort(),
    [...NARRATIVE_BACKGROUND_IDS].sort(),
  );
  assert.deepEqual(
    [...textCounts.entries()].filter(([, count]) => count > 1),
    [["Two taps. Come home.", 2]],
  );

  assert.equal(CHARACTERS.prince.name, "Zephyr");
  assert.equal(CHARACTERS.princess.name, "Princess Elowen");
  assert.equal(CHARACTERS.witch.name, "The Witch");
  assert.equal("portrait" in CHARACTERS.prince, false);
  assert.equal("portrait" in CHARACTERS.princess, false);
  assert.equal("portrait" in CHARACTERS.witch, false);

  assertDeepFrozen(CHARACTERS);
  assertDeepFrozen(NARRATIVE_SEQUENCES);
  assertDeepFrozen(FLOOR_PROJECTION_IDS);
  assertDeepFrozen(UPGRADE_SEQUENCE_IDS);
});

test("speaker staging matches the approved left right and center placements", () => {
  const counts = {};
  for (const beat of Object.values(NARRATIVE_SEQUENCES).flatMap((sequence) => sequence.beats)) {
    counts[beat.speaker] ??= {};
    counts[beat.speaker][beat.stage] = (counts[beat.speaker][beat.stage] ?? 0) + 1;
  }

  assert.deepEqual(counts, {
    prince: { left: 151, "center-left": 11, center: 3 },
    princess: { right: 123, center: 5 },
    witch: { right: 46 },
  });
});

test("the human reveal is the first direct disclosure of necromancy or incurability", () => {
  const sequences = Object.values(NARRATIVE_SEQUENCES);
  const revealIndex = sequences.findIndex((entry) => entry.id === "ending.princess-human");
  assert.ok(revealIndex > 0);

  const preRevealText = sequences
    .slice(0, revealIndex)
    .flatMap((entry) => entry.beats)
    .map((beat) => beat.text)
    .join("\n");
  assert.doesNotMatch(preRevealText, /necroman|incurab|\bno cure\b|\broot\b/i);

  const revealText = NARRATIVE_SEQUENCES["ending.princess-human"].beats.map((beat) => beat.text).join(" ");
  assert.match(revealText, /Necromancy\. Mine\./);
  assert.match(revealText, /There is no cure/);
});

test("legacy portraits presentations endings and superseded identifiers are absent", () => {
  const content = JSON.stringify({ CHARACTERS, NARRATIVE_SEQUENCES });
  assert.doesNotMatch(content, /princess-portrait|evil-queen-portrait|presentation":"(?:modal|inline)"/i);
  assert.doesNotMatch(content, /\bhomecoming\b|\bsealed\b|\bwardens\b/i);
  assert.doesNotMatch(content, /fallenKnight|Hollow Queen|old war|royal blood/i);
});

test("glossary exports one immutable notification and seven immutable entries", () => {
  assert.equal(GLOSSARY_UNLOCK_NOTIFICATION.id, "glossary.unlocked");
  assert.equal(Object.keys(GLOSSARY_ENTRIES).length, 7);
  for (const [key, entry] of Object.entries(GLOSSARY_ENTRIES)) {
    assert.equal(entry.id, key);
    assert.equal(entry.title.trim().length > 0, true);
    assert.equal(entry.text.trim().length > 0, true);
  }
  assertDeepFrozen(GLOSSARY_UNLOCK_NOTIFICATION);
  assertDeepFrozen(GLOSSARY_ENTRIES);
});
