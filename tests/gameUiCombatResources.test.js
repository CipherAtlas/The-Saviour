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
  assert.equal(view(100).filledText, "1 / 3");
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
  assert.match(uiSource, /class="hud-arch" aria-hidden="true"/);
  assert.match(uiSource, /data-hud="combat-conditions" role="group" aria-label="No active build conditions"/);
  assert.match(uiSource, /type === "combatConditionsChanged"/);
  assert.match(uiSource, /updateCombatConditions\(detail\.conditions \?\? detail\.combatConditions \?\? detail\)/);
  assert.match(uiSource, /signature === this\.lastCombatConditionSignature/);
  for (const label of ["Aegis", "Critical"]) {
    assert.match(uiSource, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(uiSource, /label: "Momentum"|label: "Tithes"|label: "Retaliation"/);
  assert.match(uiSource, /Harvest · <strong data-hud="harvest-filled">/);
  assert.doesNotMatch(uiSource, /data-hud="claim-status"|segments ready|Building segment/);
  assert.match(uiSource, /wakeHud\(\)/);
  assert.match(uiSource, /this\.hudTop\.classList\.add\("is-awake"\)/);
  assert.match(uiSource, /clearTimeout\(this\.harvestFeedbackTimer\)/);
  assert.match(uiSource, /this\.harvestMeter\.dataset\.feedback = state/);
  assert.match(uiSource, /\+\$\{amount\} Harvest gained/);
  assert.match(uiSource, /−\$\{amount\} Harvest spent/);
  assert.match(uiSource, /Tap X combo \/ hold X Grave Line \(1 dash\) · Y Reap · RB Claim · A Dash · Back build · Menu pause/);
  assert.match(uiSource, /Charge dash spent/);
  assert.doesNotMatch(uiSource, /reroll-upgrades|upgradeRerolled|rerollUpgradeOffer/);

  assert.match(styles, /\.touch-aim-stick/);
  assert.match(styles, /env\(safe-area-inset-right\)/);
  assert.match(styles, /min-width: 44px/);
  assert.match(styles, /\.high-contrast \.harvest-segment/);
  assert.match(styles, /\.harvest-meter\[data-feedback="gain"\]/);
  assert.match(styles, /\.harvest-meter\[data-feedback="spend"\]/);
  assert.match(styles, /\.high-contrast \.harvest-meter\[data-feedback="gain"\]/);
  assert.match(styles, /\.high-contrast \.harvest-meter\[data-feedback="spend"\]/);
  assert.match(styles, /\.combat-condition-strip \{/);
  assert.match(styles, /\.high-contrast \.combat-condition-strip/);
  assert.match(styles, /\.hud-arch img/);
  assert.match(styles, /\.hud-arch \{[\s\S]*?mix-blend-mode: screen;[\s\S]*?mask-image:/);
  assert.match(styles, /\.hud-arch img \{[\s\S]*?mix-blend-mode: screen;/);
  assert.match(styles, /\.hud-top \{\s*position: absolute;\s*top: auto;\s*bottom: max\(1\.5rem, env\(safe-area-inset-bottom\)\);\s*left: max\(1\.5rem, env\(safe-area-inset-left\)\);/);
  assert.match(styles, /transform: scale\(min\(var\(--gameplay-ui-width-scale\), var\(--gameplay-ui-height-scale\)\)\);/);
  assert.match(styles, /transform-origin: bottom left;/);
  assert.match(styles, /@media \(max-width: 1023px\) \{\s*\.hud \{ --gameplay-ui-width-scale: 0\.76; \}/);
  assert.match(styles, /@media \(max-height: 619px\) \{\s*\.hud \{ --gameplay-ui-height-scale: 0\.72; \}/);
  assert.match(styles, /transform: translateX\(-50%\) scale\(min\(var\(--gameplay-ui-width-scale\), var\(--gameplay-ui-height-scale\)\)\);/);
  assert.match(styles, /@media \(max-height: 620px\) and \(min-width: 761px\) \{[\s\S]*?transform: scale\(min\(var\(--gameplay-ui-width-scale\), var\(--gameplay-ui-height-scale\)\)\);[\s\S]*?transform-origin: top right;/);
  assert.match(styles, /\.bar\.dash-bar/);
  assert.match(styles, /\.hud-top\.is-awake/);
  assert.match(styles, /\.bar\.health-bar \{\s*height: 1rem;[\s\S]*?border: 3px double/);
  assert.match(styles, /\.bar\.dash-bar \{\s*height: 0\.82rem;[\s\S]*?border: 3px double/);
  assert.match(styles, /@media \(max-height: 620px\) and \(min-width: 761px\)/);
  assert.match(styles, /\.reduced-motion \.harvest-segment\[data-state="ready"\]/);
  assert.match(styles, /\.reduced-motion \.harvest-meter\[data-feedback\]/);
  assert.match(styles, /@media \(max-height: 620px\)/);
  assert.doesNotMatch(styles, /\.reroll-button/);
  assert.doesNotMatch(styles, /\.upgrade-actions|\.upgrade-confirm/);
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

test("the Oath overlay uses concise cards and a compact mastery list", () => {
  const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  const background = statSync(new URL("../public/assets/ui/upgrade-scythe-dial-background.png", import.meta.url));
  const optionStuds = ["reaper", "shade", "grave"].map((path) =>
    statSync(new URL(`../public/assets/ui/upgrade-option-${path}-stud.png`, import.meta.url))
  );

  assert.match(uiSource, /const upgradeDialBackgroundUrl = publicAssetUrl\("assets\/ui\/upgrade-scythe-dial-background\.png"\)/);
  assert.equal([...uiSource.matchAll(/src="\$\{upgradeDialBackgroundUrl\}"/g)].length, 2);
  assert.match(uiSource, /stud\.className = "upgrade-card-stud"/);
  assert.match(uiSource, /content\.className = "upgrade-card-content"/);
  assert.equal([...uiSource.matchAll(/class="upgrade-ledger"/g)].length, 1);
  assert.equal([...uiSource.matchAll(/data-upgrade-detail role="region" aria-live="polite"/g)].length, 0);
  assert.doesNotMatch(uiSource, /data-upgrade-confirm|upgrade-confirm|upgrade-actions/);
  assert.doesNotMatch(uiSource, /description\.textContent = choice\.description/);
  assert.doesNotMatch(uiSource, /current-build-summary|data-build-summary|pause-build-summary/);
  assert.match(uiSource, /data-screen="build" data-menu-overlay role="dialog"/);
  assert.match(uiSource, /data-build-ledger/);
  assert.match(uiSource, /updateProgressionState\(snapshot = \{\}\)/);
  assert.match(uiSource, /renderBuildLedger\(build = this\.progressionState\)/);
  assert.match(uiSource, /progressionDefinition\(owned\.id\)/);
  assert.match(uiSource, /for \(const slot of TECHNIQUE_SLOTS\)/);
  assert.match(uiSource, /title\.textContent = "No oath sworn"/);
  assert.match(uiSource, /\["Gain", benefit, "gain"\]/);
  assert.match(uiSource, /\["Tradeoff", progressionCopy\(choice\.cost\)/);
  assert.doesNotMatch(uiSource, /appendTextRow\("Locks"|data-detail="rank-total"|Synergy/);
  assert.match(uiSource, /offer\.selectionMode === "mastery"/);
  assert.match(uiSource, /Choose one owned Oath to raise to Rank II\./);
  assert.match(uiSource, /technique\.className = "upgrade-technique"/);
  assert.match(uiSource, /this\.lastBlessingOfferContext = offer/);
  assert.match(uiSource, /this\.lastBlessingOfferContext \?\? offer/);
  assert.match(uiSource, /upgrade-option-\$\{choicePath\.toLowerCase\(\)\}-stud\.png/);
  assert.equal([...uiSource.matchAll(/class="upgrade-heading"/g)].length, 1);
  assert.equal([...uiSource.matchAll(/data-action="reroll-upgrades"/g)].length, 0);
  assert.doesNotMatch(uiSource, /Choose a focused rank before opening the next chamber\./);
  assert.doesNotMatch(uiSource, /One deterministic reroll remains on this floor\./);
  assert.match(uiSource, /button\.addEventListener\("click", \(\) => choose\(choice\.id\)\)/);
  assert.match(uiSource, /addEventListener\("contextmenu", \(event\) => \{[\s\S]*choiceButton\.click\(\)/);
  assert.match(uiSource, /accept with Space, E, or right click/);
  assert.match(uiSource, /\["ArrowDown", "ArrowRight"\]\.includes\(event\.key\)/);
  assert.match(uiSource, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*const nextIndex/);
  assert.doesNotMatch(uiSource, /selectChoice|confirm\.onclick|findIndex\(\(button\) => button\.classList\.contains\("path-shade"\)/);
  assert.match(uiSource, /queueMicrotask\(\(\) => buttons\[0\]\?\.focus\(\{ preventScroll: true \}\)\)/);
  assert.match(styles, /\.upgrade-dial-art/);
  assert.match(styles, /\.upgrade-card\.path-shade \{[\s\S]*?--path-color: #69c8e8;/);
  assert.match(styles, /\.upgrade-card \{[\s\S]*?border: 1px solid color-mix\(in srgb, var\(--path-color\) 72%/);
  assert.match(styles, /\.upgrade-ledger \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.upgrade-grid \{[\s\S]*?grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /\.upgrade-card\.is-selected/);
  assert.match(styles, /\.upgrade-grid\.is-mastery/);
  assert.match(styles, /\.mastery-choice/);
  assert.match(styles, /\.build-panel \{/);
  assert.match(styles, /\.build-item-list \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.build-item-details \{/);
  assert.match(styles, /@media \(max-height: 760px\) and \(min-width: 1101px\)/);
  assert.match(styles, /@media \(pointer: coarse\), \(max-width: 1100px\) \{[\s\S]*?\.upgrade-ledger \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.upgrade-card:hover \.upgrade-card-stud/);
  assert.match(styles, /transform: translateY\(-0\.42rem\) scale\(1\.018\)/);
  assert.match(styles, /\.upgrade-card:focus-visible \{[\s\S]*?outline: 2px solid/);
  assert.match(styles, /\.reduced-motion \.upgrade-card:hover,[\s\S]*?transform: none/);
  assert.doesNotMatch(styles, /\.upgrade-card:hover::after|@keyframes upgrade-selector-pulse/);
  assert.ok(background.size > 100_000);
  assert.ok(optionStuds.every((asset) => asset.size > 10_000));
});
