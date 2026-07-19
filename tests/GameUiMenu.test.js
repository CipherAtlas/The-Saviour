import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GameUi } from "../src/ui/GameUi.js";
import { RunSessionController } from "../src/game/RunSessionController.js";

const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");

function actionBranch(action, nextAction) {
  const start = uiSource.indexOf(`if (action === "${action}")`);
  const end = uiSource.indexOf(`if (action === "${nextAction}")`, start + 1);
  assert.notEqual(start, -1, `missing ${action} action branch`);
  assert.notEqual(end, -1, `missing ${nextAction} action branch after ${action}`);
  return uiSource.slice(start, end);
}

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  add(...names) {
    for (const name of names) this.names.add(name);
  }

  remove(...names) {
    for (const name of names) this.names.delete(name);
  }

  contains(name) {
    return this.names.has(name);
  }

  toggle(name, force) {
    const enabled = force ?? !this.names.has(name);
    if (enabled) this.names.add(name);
    else this.names.delete(name);
    return enabled;
  }
}

class FakeNode {
  constructor() {
    this.children = [];
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.className = "";
    this.dataset = {};
    this.disabled = false;
    this.innerHTML = "";
    this.textContent = "";
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  prepend(...nodes) {
    this.children.unshift(...nodes);
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
    this.textContent = "";
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => new FakeNode() };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

function titleHarness(titleState, assetsReady = true) {
  const continueButton = new FakeNode();
  const quitButton = new FakeNode();
  const status = new FakeNode();
  const nodes = new Map([
    ["[data-action='continue-run']", continueButton],
    ["[data-action='quit']", quitButton],
    ["[data-title-status]", status],
  ]);
  const ui = {
    assetsReady,
    runSession: { titleState: () => titleState },
    root: { querySelector: (selector) => nodes.get(selector) },
    setTitleStatus(message) { status.textContent = message; },
  };
  GameUi.prototype.refreshTitleState.call(ui);
  return { continueButton, quitButton, status };
}

function renderSummary(summary) {
  return withFakeDocument(() => {
    const container = new FakeNode();
    GameUi.prototype.renderRunSummary.call({
      root: { querySelector: () => container },
    }, summary);
    const list = container.children[1];
    return Object.fromEntries(list.children.map((item) => [
      item.children[0].textContent,
      item.children[1].textContent,
    ]));
  });
}

test("New Descent opens difficulty first and starts only from an explicit difficulty choice", () => {
  const newRun = actionBranch("new-run", "retry");
  assert.match(newRun, /this\.openDifficulty\(button, createRunSeed\(\)\)/);
  assert.doesNotMatch(newRun, /startNewRun|game\.startRun/);

  const choice = actionBranch("choose-difficulty", "continue-run");
  assert.match(choice, /const difficultyId = button\.dataset\.difficulty/);
  assert.match(choice, /runSession\?\.startNewRun\(seed, difficultyId\)/);
  assert.match(choice, /await this\.audio\.resume\(\)/);
  assert.match(uiSource, /for \(const profile of Object\.values\(DIFFICULTY\)\)/);
  assert.match(uiSource, /if \(!this\.assetsReady\)[\s\S]*The realm is still loading/);
});

test("Continue is gated by a freshly validated suspend and by asset readiness", () => {
  const valid = {
    continueRun: { difficultyId: "ruthless", floor: 7, room: 2, savedAt: 10 },
    canQuit: false,
  };
  const loading = titleHarness(valid, false);
  assert.equal(loading.continueButton.classList.contains("hidden"), false);
  assert.equal(loading.continueButton.disabled, true);

  const ready = titleHarness(valid, true);
  assert.equal(ready.continueButton.classList.contains("hidden"), false);
  assert.equal(ready.continueButton.disabled, false);
  assert.equal(ready.continueButton.textContent, "Continue · Floor 7, Chamber 2 · Ruthless");

  const invalid = titleHarness({ continueRun: null, canQuit: false }, true);
  assert.equal(invalid.continueButton.classList.contains("hidden"), true);
  assert.equal(invalid.continueButton.disabled, true);

  let loadCount = 0;
  let resumeCount = 0;
  const suspendedRuns = {
    loadValid() {
      loadCount += 1;
      return loadCount === 1
        ? { difficultyId: "story", nextFloor: 3, nextRoom: 1, savedAt: 12 }
        : null;
    },
    getStatus: () => ({ storageError: null }),
    clear() {},
  };
  const controller = new RunSessionController({
    game: { resumeRun() { resumeCount += 1; return true; } },
    settings: { set() {} },
    suspendedRuns,
    statistics: {
      getStatus: () => ({ storageError: null }),
      getSnapshot: () => ({}),
      flush: () => true,
    },
  });
  assert.equal(controller.titleState().continueRun.floor, 3);
  assert.equal(controller.continueRun(), false, "activation must revalidate instead of trusting title state");
  assert.equal(resumeCount, 0);

  const continueBranch = actionBranch("continue-run", "open-records");
  assert.match(continueBranch, /runSession\?\.continueRun\(\)/);
  assert.match(continueBranch, /this\.refreshTitleState\(\)/);
});

test("Records render an empty state and separate Story, Standard, and Ruthless comparisons", () => {
  withFakeDocument(() => {
    const content = new FakeNode();
    const statistics = {
      attempts: 0,
      totalActivePlaytimeSeconds: 0,
      boss: { clears: 0, attempts: 0 },
      highestHit: 0,
      completions: {
        story: { kill: 1, timeout: 2 },
        standard: { kill: 3, timeout: 4 },
        ruthless: { kill: 5, timeout: 6 },
      },
      deepestFloor: { story: 2, standard: 6, ruthless: 9 },
      bestCompletionTimeSeconds: { story: 61, standard: 125, ruthless: null },
    };
    GameUi.prototype.renderRecords.call({
      runSession: {
        recordsSnapshot: () => ({
          statistics,
          derived: {
            completions: 21,
            completionRate: 0,
            preferredPath: null,
            mostSelectedUpgrade: null,
            favoriteMajorAction: null,
          },
          storageError: null,
        }),
      },
      root: { querySelector: () => content },
    });

    assert.equal(content.children.length, 3);
    assert.match(content.children[0].innerHTML, /<strong>0<\/strong><span>Attempts<\/span>/);
    const difficulties = content.children[1];
    assert.equal(difficulties.children.length, 3);
    assert.match(difficulties.children[0].innerHTML, /Story[\s\S]*Deepest floor[\s\S]*2[\s\S]*Mercy ending[\s\S]*1[\s\S]*Release ending[\s\S]*2[\s\S]*1:01/);
    assert.match(difficulties.children[1].innerHTML, /Standard[\s\S]*6[\s\S]*3[\s\S]*4[\s\S]*2:05/);
    assert.match(difficulties.children[2].innerHTML, /Ruthless[\s\S]*9[\s\S]*5[\s\S]*6[\s\S]*—/);
    assert.match(content.children[2].textContent, /No descent has ended yet/);
  });

  const reset = actionBranch("request-reset-records", "request-abandon-run");
  assert.match(reset, /this\.openConfirmation\(/);
  assert.ok(reset.indexOf("this.runSession?.resetStatistics()") > reset.indexOf("onConfirm:"));
  assert.match(uiSource, /if \(action === "confirm-menu"\)[\s\S]*confirm\?\.\(\)/);
});

test("Credits contain the complete required attribution and no voice-acting entry", () => {
  const start = uiSource.indexOf('data-screen="credits"');
  const end = uiSource.indexOf('data-screen="confirmation"', start);
  const credits = uiSource.slice(start, end);
  for (const required of [
    "Lamentation",
    "Darkest Child",
    "Darkest Child var A",
    "Constancy",
    "Death of Kings",
    "Unlight",
    "Kevin MacLeod",
    "Creative Commons Attribution 4.0",
    "KayKit",
    "CC0 1.0 Universal",
    "public/assets/LICENSES.md",
  ]) assert.match(credits, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(credits, /voice(?:\s|-)?acting|voice actor/i);
});

test("title utilities and secondary archives share the indexed menu structure", () => {
  const titleStart = uiSource.indexOf('class="screen title-screen"');
  const titleEnd = uiSource.indexOf('data-screen="difficulty"', titleStart);
  const title = uiSource.slice(titleStart, titleEnd);
  assert.match(title, /<nav class="title-actions" aria-label="Main menu">/);
  for (const [index, action] of [
    ["01", "continue-run"],
    ["02", "new-run"],
    ["03", "open-records"],
    ["04", "open-glossary"],
    ["05", "open-settings"],
    ["06", "open-credits"],
  ]) assert.match(title, new RegExp(`data-action="${action}" data-menu-index="${index}"`));

  assert.match(uiSource, /class="glossary-layout"/);
  assert.match(uiSource, /data-glossary-entries role="tablist"/);
  assert.match(uiSource, /data-glossary-detail role="tabpanel"/);
  assert.match(uiSource, /ArrowUp: -1,[\s\S]*ArrowDown: 1,[\s\S]*Home: "first",[\s\S]*End: "last"/);
  assert.match(uiSource, /event\.preventDefault\(\);[\s\S]*event\.stopPropagation\(\);[\s\S]*this\.moveGlossarySelection/);
  assert.match(uiSource, /text\.textContent = entry\.text/);
  assert.match(uiSource, /activeControl\?\.matches\?\.\("\.glossary-index-button"\)[\s\S]*moveGlossarySelection/);
});

test("Quit visibility follows the explicit host capability", () => {
  const browser = titleHarness({ continueRun: null, canQuit: false });
  assert.equal(browser.quitButton.classList.contains("hidden"), true);
  const supported = titleHarness({ continueRun: null, canQuit: true });
  assert.equal(supported.quitButton.classList.contains("hidden"), false);
  assert.match(uiSource, /if \(action === "quit"\)[\s\S]*runSession\?\.quit\(\)/);
  assert.match(mainSource, /platform: Object\.freeze\(\{ canQuit: false, quit: null \}\)/);
});

test("ordinary death and both endings render a concise product-facing run summary", () => {
  const base = {
    difficultyId: "standard",
    durationSeconds: 125,
    deepestFloor: 8,
    roomsCleared: 18,
    enemiesKilled: { byType: { boneguard: 12, wraith: 7 } },
    damageDealt: 1234,
    highestHit: 98,
    pathTotals: { Reaper: 4, Shade: 7, Grave: 2 },
  };
  const mercy = renderSummary({ ...base, terminal: { kind: "ending", id: "kill" } });
  assert.deepEqual(mercy, {
    Outcome: "Mercy ending",
    Difficulty: "Standard",
    Time: "2:05",
    "Deepest floor": "8",
    "Rooms cleared": "18",
    "Enemies reaped": "19",
    "Damage dealt": "1234",
    "Highest hit": "98",
    "Preferred path": "Shade",
  });
  assert.equal(renderSummary({ ...base, terminal: { kind: "ending", id: "timeout" } }).Outcome, "Release ending");
  assert.equal(renderSummary({ ...base, terminal: { kind: "death", cause: "boneguard" } }).Outcome, "Boneguard");
  assert.match(uiSource, /if \(type === "runEnded"\) this\.showEnding\(detail\)/);
  assert.match(uiSource, /this\.renderRunSummary\(this\.runSession\?\.lastRunSummary\?\.\(\)\)/);
  assert.ok(mainSource.indexOf("runSession.handleEvent(event)") < mainSource.indexOf("ui.handleEvent(event)"));
});

test("menu overlays expose modal semantics, bounded focus, Escape/back, and focus restoration", () => {
  assert.equal([...uiSource.matchAll(/data-menu-overlay role="(?:dialog|alertdialog)" aria-modal="true"/g)].length, 4);
  assert.match(uiSource, /this\.menuReturnFocus = trigger \?\? document\.activeElement/);
  assert.match(uiSource, /if \(restoreFocus\) this\.menuReturnFocus\?\.focus\?\.\(\)/);
  assert.match(uiSource, /if \(event\.key === "Tab"\)[\s\S]*this\.trapTab\(event, menuScope\)/);
  assert.match(uiSource, /if \(event\.key === "Escape"\)[\s\S]*this\.closeMenuOverlay\(\)/);
  assert.match(uiSource, /const back = this\.input\.consumePressed\("pause"\) \?\? this\.input\.consumePressed\("dash"\)/);
  assert.match(uiSource, /if \(this\.menuOverlay === "confirmation"\)[\s\S]*cancel-confirmation/);
});
