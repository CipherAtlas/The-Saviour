import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { combatResourceViewModel } from "../src/ui/GameUi.js";

function view(units, phase = "idle") {
  return combatResourceViewModel({ units }, { phase });
}

test("Harvest view models expose exactly three deterministic non-color segment states", () => {
  const cases = [
    { units: 0, states: ["empty", "empty", "empty"], filled: 0, status: "Empty" },
    { units: 42, states: ["partial", "empty", "empty"], filled: 0, status: "Empty" },
    { units: 100, states: ["ready", "empty", "empty"], filled: 1, status: "Ready" },
    { units: 299, states: ["ready", "ready", "partial"], filled: 2, status: "Ready" },
    { units: 300, states: ["ready", "ready", "ready"], filled: 3, status: "Ready" },
  ];

  for (const expected of cases) {
    const model = view(expected.units);
    assert.equal(model.segments.length, 3);
    assert.deepEqual(model.segments.map(({ state }) => state), expected.states);
    assert.equal(model.filledSegments, expected.filled);
    assert.equal(model.claimStatus, expected.status);
    assert.equal(model.units, expected.units);
    assert.match(model.ariaValueText, new RegExp(`${expected.units} of 300 Harvest units`));
    assert.match(model.ariaValueText, new RegExp(`${expected.filled} of 3 segments filled`));
    assert.ok(model.segments.every(({ marker }) => marker.length > 0));
  }

  assert.deepEqual(view(42).segments.map(({ marker }) => marker), ["◐", "○", "○"]);
  assert.deepEqual(view(100).segments.map(({ marker }) => marker), ["✦", "○", "○"]);
});

test("Claim phases produce explicit status text and suppress ready styling while active", () => {
  const labels = {
    outbound: "Throw",
    recalling: "Recall",
    empoweredWindow: "Catch attack",
    empoweredCleave: "Cleave",
    recovery: "Recover",
  };

  for (const [phase, label] of Object.entries(labels)) {
    const model = view(100, phase);
    assert.equal(model.claimStatus, label);
    assert.equal(model.segments[0].state, "filled");
    assert.match(model.ariaValueText, new RegExp(`Claim ${label}`));
  }
});

test("HUD and touch source retain the accessibility, capture, and authored layout contracts", () => {
  const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.equal([...uiSource.matchAll(/data-harvest-segment="\d"/g)].length, 3);
  assert.match(uiSource, /role="progressbar"[^>]+aria-valuemin="0"[^>]+aria-valuemax="300"/);
  assert.match(uiSource, /data-touch-aim-stick/);
  assert.match(uiSource, /data-touch-action="claim"/);
  assert.equal([...uiSource.matchAll(/data-touch-action="(?:attack|heavy|dash|claim)"/g)].length, 4);
  assert.match(uiSource, /setPointerCapture/);
  assert.match(uiSource, /addEventListener\("pointerup", releaseAction\)/);
  assert.match(uiSource, /addEventListener\("pointercancel", releaseAction\)/);
  assert.match(uiSource, /setTouchAim\(x, y\)/);
  assert.match(uiSource, /signature === this\.lastCombatResourceSignature/);
  assert.match(uiSource, /event\.detail\?\.current/);
  assert.match(uiSource, /type === "harvestChanged"/);
  assert.match(uiSource, /role="status" aria-live="polite"/);
  assert.match(uiSource, /clearTimeout\(this\.harvestFeedbackTimer\)/);
  assert.match(uiSource, /this\.harvestMeter\.dataset\.feedback = state/);
  assert.match(uiSource, /\+\$\{amount\} Harvest gained/);
  assert.match(uiSource, /−\$\{amount\} Harvest spent/);
  assert.match(uiSource, /X Strike · Y Reap · RB Claim · A Dash · Menu pause/);
  assert.equal([...uiSource.matchAll(/data-action="reroll-upgrades"/g)].length, 2);
  assert.match(uiSource, /if \(action === "reroll-upgrades"\) this\.game\.rerollUpgradeOffer\(\)/);
  assert.match(uiSource, /type === "upgradeRerolled"/);
  assert.match(uiSource, /button\.disabled = !available/);
  assert.match(uiSource, /data-reroll-status role="status" aria-live="polite"/);

  assert.match(styles, /\.touch-aim-stick/);
  assert.match(styles, /env\(safe-area-inset-right\)/);
  assert.match(styles, /min-width: 44px/);
  assert.match(styles, /\.high-contrast \.harvest-segment/);
  assert.match(styles, /\.harvest-meter\[data-feedback="gain"\]/);
  assert.match(styles, /\.harvest-meter\[data-feedback="spend"\]/);
  assert.match(styles, /\.high-contrast \.harvest-meter\[data-feedback="gain"\]/);
  assert.match(styles, /\.high-contrast \.harvest-meter\[data-feedback="spend"\]/);
  assert.match(styles, /\.reduced-motion \.harvest-segment\[data-state="ready"\]/);
  assert.match(styles, /\.reduced-motion \.harvest-meter\[data-feedback\]/);
  assert.match(styles, /@media \(max-height: 620px\)/);
  assert.match(styles, /\.reroll-button:disabled/);
  assert.match(styles, /\.upgrade-actions/);
});

test("spatial combat numbers replace HUD damage spam and expose bounded renderer and benchmark metrics", () => {
  const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
  const menuSource = readFileSync(new URL("../src/ui/SettingsMenu.js", import.meta.url), "utf8");
  const rendererSource = readFileSync(new URL("../src/rendering/GameRenderer.js", import.meta.url), "utf8");
  const benchmarkSource = readFileSync(new URL("../src/benchmark/benchmarkHarness.js", import.meta.url), "utf8");

  assert.doesNotMatch(uiSource, /type === "enemyHit"[^\n]+showMessage/);
  assert.match(menuSource, /Spatial combat numbers/);
  assert.match(menuSource, /spatial damage, mitigation, and healing meaning above combatants/);
  assert.match(rendererSource, /this\.damageNumbers\.update\(dt, this\.cameraSystem\.camera/);
  assert.match(rendererSource, /saturateDamageNumbersForBenchmark/);
  assert.match(rendererSource, /const damageNumbers = this\.damageNumbers\.metrics\(\)/);
  assert.match(benchmarkSource, /state\.maxDamageNumbers === 48/);
  assert.match(benchmarkSource, /state\.maxDamageNumberDomNodes === 48/);
  assert.match(benchmarkSource, /state\.maxDamageNumberAggregated > 0/);
});
