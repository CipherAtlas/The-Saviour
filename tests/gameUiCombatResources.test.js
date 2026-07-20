import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
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

test("Grave Line reuses a filled Harvest segment as its live buildup bar", () => {
  const model = combatResourceViewModel(
    { units: 200 },
    { phase: "idle" },
    { chargingPrimary: true, primaryCharge: 0.36 },
  );
  assert.equal(model.phase, "lineCharge");
  assert.equal(model.claimStatus, "Grave Line 50%");
  assert.deepEqual(model.segments.map(({ state }) => state), ["ready", "charging", "empty"]);
  assert.equal(model.segments[1].fillPercent, 50);
  assert.match(model.ariaValueText, /Grave Line 50%/);
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
  assert.match(uiSource, /Tap X combo \/ hold X Grave Line \(1 dash\) · Y Reap · RB Claim · A Dash · Menu pause/);
  assert.match(uiSource, /Charge dash spent/);
  assert.equal([...uiSource.matchAll(/data-action="reroll-upgrades"/g)].length, 2);
  assert.match(uiSource, /if \(action === "reroll-upgrades"\) this\.game\.rerollUpgradeOffer\(\)/);
  assert.match(uiSource, /type === "upgradeRerolled"/);
  assert.match(uiSource, /button\.disabled = !available/);
  assert.doesNotMatch(uiSource, /data-reroll-status/);

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

test("upgrade overlays use the authored scythe dial while preserving live controls", () => {
  const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const background = statSync(new URL("../public/assets/ui/upgrade-scythe-dial-background.png", import.meta.url));
  const optionSprites = ["reaper", "shade", "grave"].map((path) =>
    statSync(new URL(`../public/assets/ui/upgrade-option-${path}-sprite.png`, import.meta.url))
  );
  const optionStuds = ["reaper", "shade", "grave"].map((path) =>
    statSync(new URL(`../public/assets/ui/upgrade-option-${path}-stud.png`, import.meta.url))
  );

  assert.match(uiSource, /const upgradeDialBackgroundUrl = publicAssetUrl\("assets\/ui\/upgrade-scythe-dial-background\.png"\)/);
  assert.equal([...uiSource.matchAll(/src="\$\{upgradeDialBackgroundUrl\}"/g)].length, 2);
  assert.match(uiSource, /art\.className = "upgrade-card-art"/);
  assert.match(uiSource, /stud\.className = "upgrade-card-stud"/);
  assert.match(uiSource, /content\.className = "upgrade-card-content"/);
  assert.match(uiSource, /details\.className = "upgrade-details"/);
  assert.doesNotMatch(uiSource, /description\.textContent = choice\.description/);
  assert.match(uiSource, /appendDetail\("Build", profile\.join\(" · "\), "summary"\)/);
  assert.match(uiSource, /upgrade-option-\$\{choice\.path\.toLowerCase\(\)\}-sprite\.png/);
  assert.match(uiSource, /upgrade-option-\$\{choice\.path\.toLowerCase\(\)\}-stud\.png/);
  assert.equal([...uiSource.matchAll(/class="upgrade-heading"/g)].length, 2);
  assert.equal([...uiSource.matchAll(/data-action="reroll-upgrades"/g)].length, 2);
  assert.doesNotMatch(uiSource, /Choose a focused rank before opening the next chamber\./);
  assert.doesNotMatch(uiSource, /One deterministic reroll remains on this floor\./);
  assert.match(uiSource, /buttons\[Math\.min\(1, buttons\.length - 1\)\]\?\.focus\(\)/);
  assert.match(styles, /aspect-ratio: 1671 \/ 941/);
  assert.match(styles, /\.upgrade-dial-art/);
  assert.match(styles, /\.upgrade-card\.path-shade \{[\s\S]*?--path-color: #69c8e8;/);
  assert.match(styles, /transform-origin: var\(--stud-x\) 89%/);
  assert.match(styles, /\.upgrade-card:hover,\s*\n\.upgrade-card:focus-visible \{[\s\S]*?transform: translateY\(-1\.5%\) scale\(1\.045\);/);
  assert.match(styles, /\.upgrade-card-content \{[\s\S]*?left: calc\(var\(--content-x\) - 50%\);[\s\S]*?width: var\(--content-width\);/);
  assert.match(styles, /--content-width: 52%;/);
  assert.match(styles, /\.upgrade-details \{[\s\S]*?display: grid;/);
  assert.match(styles, /@media \(pointer: coarse\), \(max-width: 1280px\) \{[\s\S]*?\.upgrade-dial-art \{\s*display: none;/);
  assert.match(styles, /\.upgrade-card:hover \.upgrade-card-art/);
  assert.match(styles, /\.upgrade-card:hover \.upgrade-card-stud/);
  assert.doesNotMatch(styles, /\.upgrade-card:hover::after|@keyframes upgrade-selector-pulse/);
  assert.ok(background.size > 100_000);
  assert.ok(optionSprites.every((asset) => asset.size > 100_000));
  assert.ok(optionStuds.every((asset) => asset.size > 10_000));
});
