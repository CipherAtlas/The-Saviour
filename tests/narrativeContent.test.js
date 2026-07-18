import assert from "node:assert/strict";
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
  GLOSSARY_ENTRIES,
  GLOSSARY_UNLOCK_NOTIFICATION,
} from "../src/game/glossaryContent.js";

function assertDeepFrozen(value) {
  if (!value || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

test("narrative registries cover ten projections and twenty-nine upgrade offers", () => {
  assert.equal(FLOOR_PROJECTION_IDS.length, 10);
  assert.deepEqual(
    FLOOR_PROJECTION_IDS,
    Array.from({ length: 10 }, (_unused, index) => `floor.f${String(index + 1).padStart(2, "0")}.witch`),
  );

  assert.equal(UPGRADE_SEQUENCE_IDS.length, 29);
  assert.equal(new Set(UPGRADE_SEQUENCE_IDS).size, 29);
  assert.equal(upgradeSequenceId(1, 1), "floor.f01.upgrade.r01");
  assert.equal(upgradeSequenceId(1, 2), "floor.f01.upgrade.r02");
  assert.equal(upgradeSequenceId(1, 3), "floor.f01.upgrade.threshold");
  assert.equal(upgradeSequenceId(10, 2), "floor.f10.upgrade.r02");
  assert.throws(() => upgradeSequenceId(10, 3), /boss encounter/i);
  assert.throws(() => floorProjectionId(0), /floor/i);

  for (const id of [...FLOOR_PROJECTION_IDS, ...UPGRADE_SEQUENCE_IDS]) {
    assert.ok(NARRATIVE_SEQUENCES[id], `Missing registered sequence: ${id}`);
  }
});

test("all required stable sequences exist with valid immutable schema", () => {
  const requiredIds = [
    "opening.ring",
    "opening.threshold",
    "boss.confrontation",
    "ending.witch-death",
    "ending.princess-reveal",
    "ending.princess-human",
    "ending.kill",
    "ending.timeout",
    "ending.timeout-final",
  ];
  for (const id of requiredIds) assert.ok(NARRATIVE_SEQUENCES[id], `Missing required sequence: ${id}`);

  assert.equal(Object.keys(NARRATIVE_SEQUENCES).length, 48);
  const validSpeakers = new Set(Object.keys(CHARACTERS));
  const beatIds = new Set();
  const texts = new Set();

  for (const [key, narrative] of Object.entries(NARRATIVE_SEQUENCES)) {
    assert.equal(narrative.id, key);
    assert.ok(["modal", "inline"].includes(narrative.presentation));
    assert.ok(["oncePerRun", "perOffer"].includes(narrative.repeat));
    assert.ok(narrative.beats.length > 0);

    for (const beat of narrative.beats) {
      assert.equal(typeof beat.id, "string");
      assert.equal(beatIds.has(beat.id), false, `Duplicate beat ID: ${beat.id}`);
      beatIds.add(beat.id);
      assert.equal(validSpeakers.has(beat.speaker), true, `Unknown speaker: ${beat.speaker}`);
      assert.equal(typeof beat.text, "string");
      assert.equal(beat.text.trim().length > 0, true, `Empty text: ${beat.id}`);
      assert.equal(texts.has(beat.text), false, `Duplicate narrative text: ${beat.text}`);
      texts.add(beat.text);
    }
  }

  for (const id of FLOOR_PROJECTION_IDS) {
    assert.equal(NARRATIVE_SEQUENCES[id].presentation, "modal");
    assert.equal(NARRATIVE_SEQUENCES[id].repeat, "oncePerRun");
  }
  for (const id of UPGRADE_SEQUENCE_IDS) {
    assert.equal(NARRATIVE_SEQUENCES[id].presentation, "inline");
    assert.equal(NARRATIVE_SEQUENCES[id].repeat, "perOffer");
  }

  assertDeepFrozen(CHARACTERS);
  assertDeepFrozen(NARRATIVE_SEQUENCES);
  assertDeepFrozen(FLOOR_PROJECTION_IDS);
  assertDeepFrozen(UPGRADE_SEQUENCE_IDS);
});

test("the reveal is the first disclosure of necromancy, incurability, or a root", () => {
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
  assert.match(revealText, /It was necromancy\. Mine\./);
  assert.match(revealText, /There is no cure/);
});

test("legacy endings and superseded identifiers are absent", () => {
  const content = JSON.stringify(NARRATIVE_SEQUENCES);
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
