import assert from "node:assert/strict";
import test from "node:test";
import { DialogueSystem } from "../src/game/DialogueSystem.js";

test("dialogue exposes player choices without leaking mutable content", () => {
  const dialogue = new DialogueSystem();
  const view = dialogue.start("intro");
  assert.equal(view.speaker, "Princess Elowen");
  assert.equal(view.choices.length, 2);
  assert.deepEqual(Object.keys(view.choices[0]).sort(), ["index", "text"]);
});

test("dialogue choices return meaningful gameplay effects", () => {
  const dialogue = new DialogueSystem();
  dialogue.start("queenConfrontation");
  const result = dialogue.choose(1);
  assert.match(result.response, /end loudly/i);
  assert.ok(result.effects.some((effect) => effect.type === "damage"));
  assert.ok(result.effects.some((effect) => effect.type === "bossEnrage"));
  assert.equal(dialogue.view(), null);
});

test("unknown dialogue nodes and choices fail explicitly", () => {
  const dialogue = new DialogueSystem();
  assert.throws(() => dialogue.start("missing"), /Unknown dialogue node/);
  dialogue.start("intro");
  assert.throws(() => dialogue.choose(99), /Unknown dialogue choice/);
});

