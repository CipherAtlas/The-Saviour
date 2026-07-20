import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { InputController } from "../src/game/InputController.js";
import { adjustFocusedMenuControl } from "../src/ui/GameUi.js";
import { SettingsMenu } from "../src/ui/SettingsMenu.js";

const settingsSource = readFileSync(new URL("../src/ui/SettingsMenu.js", import.meta.url), "utf8");

test("bookend text is unconditional and Settings has no misleading subtitles toggle", () => {
  assert.doesNotMatch(settingsSource, /accessibility\.subtitles|Subtitles/);
});

test("Settings exposes linked tablist, tab, and tabpanel semantics", () => {
  assert.match(settingsSource, /className = "modal settings-modal hidden"/);
  assert.match(settingsSource, /class="settings-tabs" role="tablist" aria-label="Settings categories"/);
  assert.match(settingsSource, /class="settings-content" role="tabpanel"/);
  assert.match(settingsSource, /button\.setAttribute\("role", "tab"\)/);
  assert.match(settingsSource, /button\.id = `settings-tab-\$\{tab\}`/);
  assert.match(settingsSource, /button\.setAttribute\("aria-controls", `settings-panel-\$\{tab\}`\)/);
  assert.match(settingsSource, /button\.setAttribute\("aria-selected", String\(tab === this\.activeTab\)\)/);
  assert.match(settingsSource, /button\.tabIndex = tab === this\.activeTab \? 0 : -1/);
  assert.match(settingsSource, /this\.contentElement\.id = `settings-panel-\$\{this\.activeTab\}`/);
  assert.match(settingsSource, /this\.contentElement\.setAttribute\("aria-labelledby", `settings-tab-\$\{this\.activeTab\}`\)/);
});

test("Settings tabs support arrow, Home, and End navigation with focus following selection", () => {
  assert.match(settingsSource, /ArrowUp: -1,[\s\S]*ArrowLeft: -1,[\s\S]*ArrowDown: 1,[\s\S]*ArrowRight: 1/);
  assert.match(settingsSource, /Home: "first",[\s\S]*End: "last"/);
  assert.match(settingsSource, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*this\.moveTab/);
  assert.match(settingsSource, /this\.selectTab\(tabs\[nextIndex\], true\)/);

  const selections = [];
  const menu = {
    activeTab: "graphics",
    selectTab(tab, focus) { selections.push([tab, focus]); },
  };
  SettingsMenu.prototype.moveTab.call(menu, -1);
  SettingsMenu.prototype.moveTab.call(menu, "last");
  assert.deepEqual(selections, [["controls", true], ["controls", true]]);
});

test("Settings close cancels capture, invokes its callback, and restores the exact trigger", () => {
  const calls = [];
  const menu = {
    input: { cancelCapture: () => calls.push("cancelCapture") },
    element: { classList: { add: (name) => calls.push(`hide:${name}`) } },
    onClose: () => calls.push("onClose"),
    previousFocus: { focus: () => calls.push("restoreFocus") },
  };
  SettingsMenu.prototype.close.call(menu);
  assert.deepEqual(calls, ["cancelCapture", "hide:hidden", "onClose", "restoreFocus"]);
  assert.equal(menu.onClose, null);
  assert.equal(menu.previousFocus, null);
});

function fakeControl(kind, values = {}) {
  const events = [];
  return {
    disabled: false,
    events,
    dispatchEvent(event) { events.push(event.type); },
    matches(selector) {
      return (kind === "select" && selector === "select")
        || (kind === "range" && selector === "input[type='range']")
        || (kind === "checkbox" && selector === "input[type='checkbox']");
    },
    ...values,
  };
}

test("controller adjustment changes select range and checkbox controls with bounded events", () => {
  const select = fakeControl("select", { options: [{}, {}, {}], selectedIndex: 1 });
  assert.equal(adjustFocusedMenuControl(select, 1), true);
  assert.equal(select.selectedIndex, 2);
  assert.deepEqual(select.events, ["change"]);
  assert.equal(adjustFocusedMenuControl(select, 1), false);

  const range = fakeControl("range", { min: "0", max: "1", step: "0.25", value: "0.75" });
  assert.equal(adjustFocusedMenuControl(range, 1), true);
  assert.equal(range.value, "1");
  assert.deepEqual(range.events, ["input", "change"]);
  assert.equal(adjustFocusedMenuControl(range, 1), false);

  const checkbox = fakeControl("checkbox", { checked: true });
  assert.equal(adjustFocusedMenuControl(checkbox, -1), true);
  assert.equal(checkbox.checked, false);
  assert.deepEqual(checkbox.events, ["input", "change"]);
});

test("Escape closes Settings and Tab containment wraps both ends", () => {
  assert.match(settingsSource, /this\.element\.addEventListener\("keydown", \(event\) => \{/);
  assert.match(settingsSource, /if \(event\.key === "Escape"\)[\s\S]*event\.preventDefault\(\)[\s\S]*event\.stopPropagation\(\)[\s\S]*this\.close\(\)/);
  assert.match(settingsSource, /if \(event\.key !== "Tab"\) return/);
  assert.match(settingsSource, /event\.shiftKey && document\.activeElement === first[\s\S]*last\.focus\(\)/);
  assert.match(settingsSource, /!event\.shiftKey && document\.activeElement === last[\s\S]*first\.focus\(\)/);
  assert.match(settingsSource, /!this\.element\.contains\(document\.activeElement\)[\s\S]*first\.focus\(\)/);
  assert.match(settingsSource, /open\(onClose, trigger = document\.activeElement\)[\s\S]*this\.previousFocus = trigger/);
});

test("InputController preserves native keys for focused UI controls without leaking gameplay edges", () => {
  const input = Object.create(InputController.prototype);
  input.capture = null;
  input.enabled = true;
  input.activeDevice = "keyboardMouse";
  input.activeGamepadIndex = null;
  input.activeDeviceListeners = new Set();
  input.down = new Set();
  input.pressed = new Set();
  input.pressedAt = new Map();

  let prevented = false;
  input.onKeyDown({
    target: { closest: () => ({ tagName: "SELECT" }) },
    code: "ArrowDown",
    repeat: false,
    timeStamp: 10,
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, false);
  assert.equal(input.down.size, 0);
  assert.equal(input.pressed.size, 0);

  input.onKeyDown({
    target: { closest: () => null },
    code: "ArrowDown",
    repeat: false,
    timeStamp: 20,
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(input.down.has("ArrowDown"), true);
  assert.equal(input.pressedAt.get("ArrowDown"), 20);
});

test("binding capture still takes precedence and Settings reports recoverable fullscreen failure", () => {
  const input = Object.create(InputController.prototype);
  let captured = null;
  let prevented = false;
  input.capture = (binding) => { captured = binding; };
  input.onKeyDown({
    target: { closest: () => ({ tagName: "BUTTON" }) },
    code: "KeyK",
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(captured, "KeyK");
  assert.equal(input.capture, null);

  assert.match(settingsSource, /class="settings-status" role="status" aria-live="polite"/);
  assert.match(settingsSource, /try \{[\s\S]*requestFullscreen[\s\S]*exitFullscreen[\s\S]*\} catch \{/);
  assert.match(settingsSource, /Fullscreen could not be changed\. Browser permission may be required\./);
});
