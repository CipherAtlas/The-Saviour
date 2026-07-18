import assert from "node:assert/strict";
import test from "node:test";
import { DialogueSystem } from "../src/game/DialogueSystem.js";

test("modal dialogue advances linearly through immutable public beats", () => {
  const dialogue = new DialogueSystem();
  const first = dialogue.start("opening.ring");
  assert.equal(first.speaker, "Prince");
  assert.equal(first.position, 1);
  assert.equal(first.total, 4);

  const next = dialogue.advance();
  assert.equal(next.completed, false);
  assert.equal(next.view.speaker, "Princess Elowen");
  assert.equal(next.view.position, 2);
  assert.equal(Object.isFrozen(dialogue.sequence("opening.ring")), true);

  const sensedDistance = dialogue.advance();
  assert.equal(sensedDistance.completed, false);
  assert.equal(sensedDistance.view.speaker, "Prince");
  assert.equal(sensedDistance.view.position, 3);

  const interruptedFragment = dialogue.advance();
  assert.equal(interruptedFragment.completed, false);
  assert.equal(interruptedFragment.view.speaker, "Princess Elowen");
  assert.equal(interruptedFragment.view.position, 4);

  const completed = dialogue.advance();
  assert.deepEqual(completed, { completed: true, completedId: "opening.ring", view: null });
  assert.equal(dialogue.view(), null);
});

test("inline upgrade dialogue is readable without mutating modal state", () => {
  const dialogue = new DialogueSystem();
  const beats = dialogue.readInline("floor.f01.upgrade.r01");
  assert.deepEqual(beats.map((beat) => beat.speaker), ["Princess Elowen", "Prince"]);
  assert.equal(dialogue.view(), null);
  assert.throws(() => dialogue.start("floor.f01.upgrade.r01"), /not modal/);
  assert.throws(() => dialogue.readInline("opening.ring"), /not inline/);
});

test("unknown narrative identifiers fail explicitly", () => {
  const dialogue = new DialogueSystem();
  assert.throws(() => dialogue.start("missing"), /Unknown dialogue sequence/);
  assert.throws(() => dialogue.readInline("missing"), /Unknown dialogue sequence/);
});
