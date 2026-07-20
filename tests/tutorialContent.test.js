import assert from "node:assert/strict";
import test from "node:test";
import { BLESSINGS } from "../src/game/blessings.js";
import { HARVEST_CONFIG } from "../src/game/gameConfig.js";
import {
  GLOSSARY_SECTIONS,
  TUTORIAL_STEPS,
} from "../src/ui/tutorialContent.js";

test("tutorial is a seven-step guide backed by current gameplay imagery", () => {
  assert.equal(TUTORIAL_STEPS.length, 7);
  assert.deepEqual(TUTORIAL_STEPS.map(({ id }) => id), [
    "move-aim",
    "scythe",
    "dash",
    "harvest",
    "spend-harvest",
    "build-ledger",
    "descend",
  ]);
  for (const step of TUTORIAL_STEPS) {
    assert.match(step.image, /^assets\/ui\/tutorial\/.+\.jpg$/);
    assert.ok(step.imageAlt.length > 0);
    assert.ok(step.lead.length > 0);
    assert.ok(step.lead.length <= 70);
  }
});

test("Scythe and Dash lessons include their advanced timing without another topic", () => {
  const scythe = TUTORIAL_STEPS.find(({ id }) => id === "scythe");
  const dash = TUTORIAL_STEPS.find(({ id }) => id === "dash");

  assert.equal(TUTORIAL_STEPS.some(({ id }) => id === "combat-timing"), false);
  assert.match(scythe.notes.join(" "), /hold Q or Middle Mouse/i);
  assert.match(scythe.notes.join(" "), /Perfect Reap: release in the bright window/i);
  assert.equal(dash.controls.some(({ label }) => label === "Dash Strike"), true);
  assert.match(dash.lead, /Strike before it ends for a Dash Strike/i);
});

test("build lesson teaches the dedicated ledger shortcut", () => {
  const build = TUTORIAL_STEPS.find(({ id }) => id === "build-ledger");
  assert.deepEqual(build.controls[0].actions, ["build"]);
  assert.match(build.lead, /five technique oaths, their effects, and their tradeoffs/i);
  assert.match(build.notes.join(" "), /pauses/i);
});

test("Harvest lesson stays synchronized with the combat resource contract", () => {
  const harvest = TUTORIAL_STEPS.find(({ id }) => id === "harvest");
  assert.deepEqual(
    harvest.facts.map(({ value }) => Number(value.slice(1))),
    [
      HARVEST_CONFIG.gainUnits.closeHit,
      HARVEST_CONFIG.gainUnits.critical,
      HARVEST_CONFIG.gainUnits.kill,
      HARVEST_CONFIG.gainUnits.perfectDash,
    ],
  );
  assert.equal(HARVEST_CONFIG.gainUnits.perfectDash, HARVEST_CONFIG.gainUnits.perfectCharge);
});

test("dash lesson defines Perfect Dash without overloading the Oath card", () => {
  const dash = TUTORIAL_STEPS.find(({ id }) => id === "dash");
  assert.match(dash.notes.join(" "), /dash as an enemy hit connects/i);
  assert.match(dash.notes.join(" "), /first 120 ms/i);
  assert.match(dash.notes.join(" "), new RegExp(`\\+${HARVEST_CONFIG.gainUnits.perfectDash} Harvest`));
});

test("glossary content remains separate from the seven tutorial topics", () => {
  assert.equal(TUTORIAL_STEPS.length, 7);
  assert.equal(TUTORIAL_STEPS.some(({ id }) => id === "glossary"), false);
  assert.equal(TUTORIAL_STEPS.some(({ glossarySections }) => glossarySections != null), false);
  assert.ok(GLOSSARY_SECTIONS.length > 0);
});

test("glossary covers the complete player-facing mechanics vocabulary with concise definitions", () => {
  const entries = GLOSSARY_SECTIONS.flatMap((section) => section.entries);
  const termMap = new Map(entries.map((entry) => [entry.term, entry.definition]));
  const requiredTerms = [
    "Descent",
    "Chamber Threshold",
    "Speedrun",
    "Technique Oath",
    "Mastery",
    "Reaper",
    "Shade",
    "Grave",
    "Gain",
    "Tradeoff",
    "Stagger Damage",
    "Damage Shield",
    "Aegis",
    "Aim Assist",
    "Telegraph",
    "Strike",
    "Reap",
    "Perfect Reap",
    "Perfect Charge",
    "Close Hit",
    "Harvest Segment",
    "Grave Line",
    "Reaper's Claim",
    "Catch Cleave",
    "Perfect Dash",
    "The Witch",
    "Relaxed",
    "Standard",
    "Ruthless",
  ];

  assert.ok(GLOSSARY_SECTIONS.length >= 6);
  assert.ok(entries.length >= 100);
  assert.equal(termMap.size, entries.length, "glossary terms should not be duplicated");
  for (const term of requiredTerms) assert.ok(termMap.has(term), `missing glossary term: ${term}`);
  for (const { term, definition } of entries) {
    assert.ok(term.trim().length > 0);
    assert.ok(definition.trim().length > 0);
    assert.ok(definition.length <= 180, `${term} definition is too long for the reference layout`);
  }
});

test("every named Oath is sourced into the glossary", () => {
  const namedOaths = GLOSSARY_SECTIONS.find(({ title }) => title === "Named Oaths");
  assert.ok(namedOaths);
  assert.deepEqual(
    namedOaths.entries.map(({ term }) => term),
    BLESSINGS.map(({ name }) => name),
  );
  assert.deepEqual(
    namedOaths.entries.map(({ definition }) => definition),
    BLESSINGS.map(({ description }) => description),
  );
});
