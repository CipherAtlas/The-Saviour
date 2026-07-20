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

test("bookend content is deeply frozen and limited to the intro and ending branches", () => {
  assert.deepEqual(Object.keys(BOOKEND_SEQUENCES), ["intro", "ending.plea", "ending.kill", "ending.timeout"]);
  assert.deepEqual(Object.values(BOOKEND_SEQUENCES).map(({ beats }) => beats.length), [3, 3, 2, 3]);
  assert.ok(Object.values(BOOKEND_SEQUENCES).every(Object.isFrozen));
  assert.ok(Object.values(BOOKEND_SEQUENCES).flatMap(({ beats }) => beats).every(Object.isFrozen));
});

test("unknown and overlapping bookends fail explicitly", () => {
  const reader = new BookendSequence();
  assert.throws(() => reader.start("missing"), /Unknown bookend sequence/);
  reader.start("intro");
  assert.throws(() => reader.start("ending.plea"), /another is active/);
});
