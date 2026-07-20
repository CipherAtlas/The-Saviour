import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const settingsSource = readFileSync(new URL("../src/settings/SettingsStore.js", import.meta.url), "utf8");
const settingsMenuSource = readFileSync(new URL("../src/ui/SettingsMenu.js", import.meta.url), "utf8");

test("the inline build strip is replaced by an informative B-key ledger", () => {
  assert.doesNotMatch(uiSource, /current-build-summary|data-build-summary|pause-build-summary/);
  assert.match(uiSource, /data-screen="build" data-menu-overlay role="dialog"/);
  assert.match(uiSource, /const buildInput = this\.input\.consumePressed\("build"\)/);
  assert.match(uiSource, /this\.buildResumeOnClose = this\.game\.phase === "playing"/);
  assert.match(uiSource, /this\.game\.pausedPhase === "playing"/);
  assert.match(uiSource, /appendBuildDetail\(details, "Gain"/);
  assert.match(uiSource, /appendBuildDetail\(details, "Tradeoff"/);
  assert.doesNotMatch(uiSource, /appendBuildDetail\(details, "Locks"/);
  assert.doesNotMatch(uiSource, /appendBuildDetail\(details, "Synergy"/);
  assert.doesNotMatch(uiSource, /stats\.className = "build-item-stats"/);
  assert.match(uiSource, /for \(const slot of TECHNIQUE_SLOTS\)/);
  assert.doesNotMatch(uiSource, /Chamber Runes|pathTotals|data-path-rank/);
});

test("the build ledger uses the viewport and remains reachable across input devices", () => {
  assert.match(styles, /\.build-panel \{[\s\S]*?width: min\(96rem, 96vw\);[\s\S]*?height: min\(58rem, 94vh\);/);
  assert.match(styles, /\.build-item-list \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(max-width: 900px\) \{[\s\S]*?\.build-item-list \{[\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(settingsSource, /build: Object\.freeze\(\["KeyB", "Gamepad:Back"\]\)/);
  assert.match(settingsMenuSource, /\["build", "Build ledger", "Open the current run build\.", "binding"\]/);
  assert.match(uiSource, /Back build · Menu pause/);
  assert.match(uiSource, /B build · Esc pause/);
});
