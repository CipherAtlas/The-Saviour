import assert from "node:assert/strict";
import test from "node:test";
import { BookendSequence } from "../src/game/BookendSequence.js";
import { BOOKEND_SEQUENCES } from "../src/game/bookendContent.js";

test("the bookend reader advances one complete line at a time", () => {
  const reader = new BookendSequence();
  const first = reader.start("intro");
  assert.equal(first.beatId, "intro.01");
  assert.equal(first.text, first.revealedText);
  assert.deepEqual({ position: first.position, total: first.total }, { position: 1, total: 3 });

  assert.equal(reader.advance().view.beatId, "intro.02");
  assert.equal(reader.advance().view.beatId, "intro.03");
  assert.deepEqual(reader.advance(), { completed: true, sequenceId: "intro", view: null });
  assert.equal(reader.snapshot(), null);
});

test("bookend content is deeply frozen and limited to the intro, boss confrontation, and ending branches", () => {
  assert.deepEqual(Object.keys(BOOKEND_SEQUENCES), [
    "intro",
    "boss.confrontation",
    "ending.witch-death",
    "ending.plea",
    "ending.kill",
    "ending.timeout",
    "ending.timeout-final",
  ]);
  assert.deepEqual(Object.values(BOOKEND_SEQUENCES).map(({ beats }) => beats.length), [3, 21, 16, 17, 10, 9, 3]);
  assert.ok(Object.values(BOOKEND_SEQUENCES).every(Object.isFrozen));
  assert.ok(Object.values(BOOKEND_SEQUENCES).flatMap(({ beats }) => beats).every(Object.isFrozen));
});

test("the ending explains why only Zephyr's paired-ring strike can destroy the corruption", () => {
  const witchDeath = BOOKEND_SEQUENCES["ending.witch-death"].beats.map(({ text }) => text).join(" ");
  const plea = BOOKEND_SEQUENCES["ending.plea"].beats.map(({ text }) => text).join(" ");

  assert.match(witchDeath, /ordinary death would not end the corruption/i);
  assert.match(witchDeath, /rings carry more than presence/i);
  assert.match(witchDeath, /No one else can make the strike carry your bond/i);
  assert.match(plea, /Our bond will hold the necromancy to me when I die/i);
});

test("unknown and overlapping bookends fail explicitly", () => {
  const reader = new BookendSequence();
  assert.throws(() => reader.start("missing"), /Unknown bookend sequence/);
  reader.start("intro");
  assert.throws(() => reader.start("ending.plea"), /another is active/);
});
