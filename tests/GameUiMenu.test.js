import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatSpeedrunTime, GameUi } from "../src/ui/GameUi.js";
import { RunSessionController } from "../src/game/RunSessionController.js";

const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const indexSource = readFileSync(new URL("../index.html", import.meta.url), "utf8");

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
  assert.match(uiSource, /More recovery\. Fewer threats\./);
  assert.match(uiSource, /The intended experience\./);
  assert.match(uiSource, /Faster threats\. Less mercy\./);
  assert.doesNotMatch(uiSource, /Choose the pressure|Longer warnings|Authored timing|Tighter warnings/);
});

test("Speedrun has a distinct rules gate, fixed Ruthless start path, and precise clock format", () => {
  const open = actionBranch("speedrun", "new-run");
  assert.match(open, /this\.openSpeedrunRules\(button, createRunSeed\(\)\)/);
  const start = actionBranch("start-speedrun", "choose-difficulty");
  assert.match(start, /await this\.startSpeedrun\(seed\)/);
  assert.match(uiSource, /runSession\?\.startSpeedrun\(seed\)/);
  assert.match(uiSource, /Intro and ending VN skipped/);
  assert.match(uiSource, /Fixed Ruthless balance/);
  assert.match(uiSource, /The instant the Witch dies/);
  assert.equal(formatSpeedrunTime(0), "00:00.00");
  assert.equal(formatSpeedrunTime(65.239), "01:05.23");
  assert.equal(formatSpeedrunTime(3_661.999), "1:01:01.99");
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
        ? { difficultyId: "relaxed", nextFloor: 3, nextRoom: 1, savedAt: 12 }
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

test("Records render normal difficulty comparisons and the personal Speedrun leaderboard", () => {
  withFakeDocument(() => {
    const content = new FakeNode();
    const statistics = {
      attempts: 0,
      totalActivePlaytimeSeconds: 0,
      boss: { clears: 0, attempts: 0 },
      highestHit: 0,
      completions: {
        relaxed: { kill: 1, timeout: 2 },
        standard: { kill: 3, timeout: 4 },
        ruthless: { kill: 5, timeout: 6 },
      },
      deepestFloor: { relaxed: 2, standard: 6, ruthless: 9 },
      bestCompletionTimeSeconds: { relaxed: 61, standard: 125, ruthless: null },
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
          speedrun: {
            attempts: 3,
            completions: 2,
            best: { timeSeconds: 80.25, seed: "FAST-SEED", ending: "kill" },
            leaderboard: [
              { timeSeconds: 80.25, seed: "FAST-SEED", ending: "kill" },
              { timeSeconds: 95.5, seed: "SECOND-SEED", ending: "timeout" },
            ],
          },
          storageError: null,
        }),
      },
      root: { querySelector: () => content },
    });

    assert.equal(content.children.length, 4);
    assert.match(content.children[0].innerHTML, /<strong>0<\/strong><span>Attempts<\/span>/);
    const difficulties = content.children[1];
    assert.equal(difficulties.children.length, 3);
    assert.match(difficulties.children[0].innerHTML, /Relaxed[\s\S]*Deepest floor[\s\S]*2[\s\S]*Mercy ending[\s\S]*1[\s\S]*Release ending[\s\S]*2[\s\S]*1:01/);
    assert.match(difficulties.children[1].innerHTML, /Standard[\s\S]*6[\s\S]*3[\s\S]*4[\s\S]*2:05/);
    assert.match(difficulties.children[2].innerHTML, /Ruthless[\s\S]*9[\s\S]*5[\s\S]*6[\s\S]*—/);
    const speedrun = content.children[2];
    assert.equal(speedrun.children[0].textContent, "Personal leaderboard · This browser");
    assert.equal(speedrun.children[1].textContent, "Speedrun · Ruthless · Fastest 10 Witch clears");
    assert.equal(speedrun.children[2].children[0].children[1].textContent, "3");
    assert.equal(speedrun.children[2].children[1].children[1].textContent, "2");
    const leaderboardBody = speedrun.children[3].children[0].children[2];
    assert.deepEqual(leaderboardBody.children[0].children.map(({ textContent }) => textContent), [
      "#1", "01:20.25", "FAST-SEED", "Mercy",
    ]);
    assert.deepEqual(leaderboardBody.children[1].children.map(({ textContent }) => textContent), [
      "#2", "01:35.50", "SECOND-SEED", "Hesitation",
    ]);
    assert.match(content.children[3].textContent, /No descent has ended yet/);
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

test("title utilities use a concise number-free menu structure", () => {
  const titleStart = uiSource.indexOf('class="screen title-screen"');
  const titleEnd = uiSource.indexOf('data-screen="difficulty"', titleStart);
  const title = uiSource.slice(titleStart, titleEnd);
  assert.match(title, /<nav class="title-actions" aria-label="Main menu">/);
  for (const action of [
    "continue-run",
    "new-run",
    "speedrun",
    "open-records",
    "open-tutorial",
    "open-glossary",
    "open-settings",
    "open-credits",
  ]) assert.match(title, new RegExp(`data-action="${action}"`));
  assert.doesNotMatch(title, /data-menu-index/);
  assert.doesNotMatch(title, /data-loading/);
  assert.doesNotMatch(title, /A scythe-combat action roguelite/);
  assert.match(title, /<h1 id="title-heading"><span>The Saviour<\/span><\/h1>/);

  assert.match(title, /data-action="open-tutorial"[^>]*>Tutorial<\/button>/);
  assert.match(title, /data-action="open-glossary"[^>]*>Glossary<\/button>/);
});

test("pause menu mirrors the central vertical title-menu hierarchy without subtext", () => {
  const pauseScreen = uiSource.indexOf('data-screen="pause"');
  const pauseStart = uiSource.lastIndexOf("<section", pauseScreen);
  const pauseEnd = uiSource.indexOf('data-screen="ending-decision"', pauseStart);
  const pause = uiSource.slice(pauseStart, pauseEnd);

  assert.match(pause, /class="modal pause-modal hidden"/);
  assert.match(pause, /<div class="panel pause-panel">/);
  assert.match(pause, /<header class="pause-heading">\s*<h2 id="pause-title">Paused<\/h2>\s*<\/header>/);
  assert.match(pause, /<nav class="pause-actions" aria-label="Pause menu">/);
  for (const [action, label] of [
    ["resume", "Resume"],
    ["open-build", "Build"],
    ["suspend-run", "Suspend Run"],
    ["open-tutorial", "Field Guide"],
    ["open-glossary", "Glossary"],
    ["pause-settings", "Settings"],
    ["request-abandon-run", "Abandon run"],
  ]) {
    assert.match(pause, new RegExp(`data-action="${action}"[^>]*>${label}<\\/button>`));
  }
  assert.doesNotMatch(pause, /class="eyebrow"|class="panel-copy"|The realm holds its breath/);
});

test("ending summary reuses the pause menu frame and vertical action hierarchy", () => {
  const endingScreen = uiSource.indexOf('data-screen="ending"');
  const endingStart = uiSource.lastIndexOf("<section", endingScreen);
  const endingEnd = uiSource.indexOf('data-ending="fade"', endingStart);
  const ending = uiSource.slice(endingStart, endingEnd);

  assert.match(ending, /class="modal ending-modal hidden"/);
  assert.match(ending, /role="dialog" aria-modal="true" aria-labelledby="ending-title"/);
  assert.match(ending, /<header class="ending-heading">/);
  assert.match(ending, /<div class="ending-divider" aria-hidden="true"><\/div>/);
  assert.match(ending, /<nav class="ending-actions" aria-label="End of run actions">/);
  for (const [action, label] of [
    ["retry", "Retry seed"],
    ["new-run", "New Descent"],
    ["return-title", "Title"],
  ]) {
    assert.match(ending, new RegExp(`data-action="${action}"[^>]*>${label}<\\/button>`));
  }
  assert.ok(ending.indexOf('data-action="retry"') < ending.indexOf('data-action="new-run"'));
  assert.ok(ending.indexOf('data-action="new-run"') < ending.indexOf('data-action="return-title"'));
});

test("confirmation menus reuse the pause hierarchy with the safe action first", () => {
  const confirmationScreen = uiSource.indexOf('data-screen="confirmation"');
  const confirmationStart = uiSource.lastIndexOf("<section", confirmationScreen);
  const confirmationEnd = uiSource.indexOf('data-screen="build"', confirmationStart);
  const confirmation = uiSource.slice(confirmationStart, confirmationEnd);

  assert.match(confirmation, /class="modal menu-modal confirmation-modal hidden"/);
  assert.match(confirmation, /<div class="panel pause-panel confirmation-panel">/);
  assert.match(confirmation, /<header class="confirmation-heading">\s*<h2 class="confirmation-title"/);
  assert.doesNotMatch(confirmation, /class="eyebrow"|data-confirmation-eyebrow/);
  assert.ok(confirmation.indexOf('data-action="cancel-confirmation"') < confirmation.indexOf('data-action="confirm-menu"'));
  assert.match(uiSource, /showConfirmationBackdrop\(\)/);
  assert.match(uiSource, /screen\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(uiSource, /screen\.inert = true/);
  assert.match(uiSource, /queueMicrotask\(\(\) => returnFocus\?\.focus\?\.\(\)\)/);
});

test("the approved brand icon powers the favicon, title, and icon-only loading screen", () => {
  assert.match(indexSource, /rel="icon" type="image\/png" href="%BASE_URL%assets\/branding\/the-saviour-icon\.png"/);
  assert.match(uiSource, /const brandIconUrl = publicAssetUrl\("assets\/branding\/the-saviour-icon\.png"\)/);
  assert.match(uiSource, /class="title-brand-logo" data-logo-slot="title"/);
  assert.match(uiSource, /class="screen loading-screen hidden" data-screen="loading" role="status" aria-label="Loading The Saviour">\s*<div class="loading-brand-logo" data-logo-slot="loading"><\/div>/);
  assert.match(uiSource, /this\.titleLogo = new AnimatedLogo[\s\S]*mode: AnimatedLogo\.MODES\.MAIN_MENU/);
  assert.match(uiSource, /this\.loadingLogo = new AnimatedLogo[\s\S]*mode: AnimatedLogo\.MODES\.LOADING/);
  assert.match(mainSource, /renderer\.setLoadProgressListener\(\(progress\) => ui\.setLoadingProgress\(progress\)\)/);
  assert.match(uiSource, /await this\.loadingLogo\.playCompletion\(\)/);
  assert.match(uiSource, /const brandLoading = phase === "roomLoading"[\s\S]*phase === "title" && !this\.assetsReady && !this\.loadFailed/);
  assert.match(uiSource, /\[data-screen='loading'\]"\)\.classList\.toggle\("hidden", !brandLoading\)/);
  assert.match(uiSource, /\["title", "roomLoading", "bookend"/);
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
  });
  assert.equal(renderSummary({ ...base, terminal: { kind: "ending", id: "timeout" } }).Outcome, "Release ending");
  assert.equal(renderSummary({ ...base, terminal: { kind: "death", cause: "boneguard" } }).Outcome, "Boneguard");
  const speedrunAttempt = renderSummary({
    ...base,
    runType: "speedrun",
    seed: "SAME-SEED",
    speedrunTimeSeconds: 13.63,
    speedrunFinished: false,
    terminal: { kind: "death", cause: "boneguard" },
  });
  assert.equal(speedrunAttempt.Elapsed, "00:13.63");
  assert.equal(speedrunAttempt.Leaderboard, "Not ranked");
  assert.equal(speedrunAttempt["Witch time"], undefined);
  const speedrunFinish = renderSummary({
    ...base,
    runType: "speedrun",
    seed: "SAME-SEED",
    speedrunTimeSeconds: 125.12,
    speedrunFinished: true,
    leaderboardRank: 3,
    terminal: { kind: "ending", id: "kill" },
  });
  assert.equal(speedrunFinish["Witch time"], "02:05.12");
  assert.equal(speedrunFinish.Leaderboard, "Personal rank · #3");
  assert.equal(speedrunFinish.Elapsed, undefined);
  assert.match(uiSource, /if \(type === "runEnded"\) this\.showEnding\(detail\)/);
  assert.match(uiSource, /const summary = this\.runSession\?\.lastRunSummary\?\.\(\);[\s\S]*this\.renderRunSummary\(summary\)/);
  assert.ok(mainSource.indexOf("runSession.handleEvent(event)") < mainSource.indexOf("ui.handleEvent(event)"));
});

test("menu overlays expose modal semantics, bounded focus, Escape/back, and focus restoration", () => {
  assert.equal([...uiSource.matchAll(/data-menu-overlay role="(?:dialog|alertdialog)" aria-modal="true"/g)].length, 8);
  assert.match(uiSource, /this\.menuReturnFocus = trigger \?\? document\.activeElement/);
  assert.match(uiSource, /if \(restoreFocus\) this\.menuReturnFocus\?\.focus\?\.\(\)/);
  assert.match(uiSource, /if \(event\.key === "Tab"\)[\s\S]*this\.trapTab\(event, menuScope\)/);
  assert.match(uiSource, /if \(event\.key === "Escape"\)[\s\S]*this\.closeMenuOverlay\(\)/);
  assert.match(uiSource, /const back = this\.input\.consumePressed\("pause"\) \?\? this\.input\.consumePressed\("dash"\)/);
  assert.match(uiSource, /if \(this\.menuOverlay === "confirmation"\)[\s\S]*cancel-confirmation/);
  assert.match(uiSource, /const buildInput = this\.input\.consumePressed\("build"\)/);
  assert.match(uiSource, /this\.menuOverlay === "build"\)[\s\S]*this\.closeBuild/);
});

test("tutorial follows every standard intro until explicitly disabled and remains in the pause menu", () => {
  const open = actionBranch("open-tutorial", "tutorial-topic");
  const dismiss = actionBranch("tutorial-dont-show-again", "close-menu");
  assert.match(open, /this\.openTutorial\(\{ mode: "handbook", trigger: button \}\)/);
  assert.match(dismiss, /this\.tutorialProgress\?\.dismissForever\?\.\(\)/);
  assert.match(dismiss, /this\.closeTutorial\(\)/);
  assert.match(uiSource, /data-screen="tutorial" data-menu-overlay role="dialog"/);
  assert.match(uiSource, /data-tutorial-layout="carousel"/);
  assert.match(uiSource, /data-action="tutorial-dont-show-again">Don't show again<\/button>/);
  assert.doesNotMatch(uiSource, /Pause Handbook|Return to Pause|>Reference</);
  assert.match(uiSource, /kicker\.classList\.toggle\("hidden", this\.tutorialMode === "handbook"\)/);
  assert.match(uiSource, /this\.tutorialMode === "handbook" \? "Done" : "Begin Descent"/);
  assert.doesNotMatch(uiSource, /data-tutorial-glossary|tutorial-glossary|step\.glossarySections/);
  assert.match(uiSource, /this\.game\.runType !== "normal"/);
  assert.match(uiSource, /this\.game\.floor !== 1/);
  assert.match(uiSource, /this\.game\.room !== 1/);
  assert.match(uiSource, /this\.game\.togglePause\(performance\.now\(\)\)/);
  assert.match(uiSource, /this\.openTutorial\(\{ mode: "runStart" \}\)/);
  assert.match(uiSource, /if \(type === "runStarted"\) \{[\s\S]*this\.runTutorialAttempted = false/);
  assert.doesNotMatch(uiSource, /markCompleted|mode: "firstRun"|First Descent/);
  assert.match(uiSource, /screen\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(uiSource, /screen\.inert = true/);
  assert.match(uiSource, /screen\.removeAttribute\("aria-hidden"\)/);
  assert.match(mainSource, /runTutorialEnabled: !autoplayEnabled && !showcaseMode/);
});

test("run-start tutorial attempts once per standard descent and honors persistent dismissal", async () => {
  let dismissed = false;
  let pauseCount = 0;
  const openedModes = [];
  const ui = {
    runTutorialAttempted: false,
    runTutorialEnabled: true,
    game: {
      runType: "normal",
      floor: 1,
      room: 1,
      phase: "playing",
      togglePause() {
        pauseCount += 1;
        this.phase = "paused";
      },
    },
    tutorialProgress: { shouldShow: () => !dismissed },
    menuOverlay: null,
    settingsMenu: { isOpen: false },
    openTutorial({ mode }) { openedModes.push(mode); },
    resetEndingPresentation() {},
    setTitleStatus() {},
    updateProgressionState() {},
    updateCombatConditions() {},
  };

  GameUi.prototype.scheduleRunTutorial.call(ui);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(openedModes, ["runStart"]);
  assert.equal(pauseCount, 1);

  ui.game.phase = "playing";
  GameUi.prototype.scheduleRunTutorial.call(ui);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(openedModes.length, 1, "a phase change within the same run must not reopen the tutorial");

  GameUi.prototype.handleEvent.call(ui, { type: "runStarted", detail: {} });
  ui.game.phase = "playing";
  GameUi.prototype.scheduleRunTutorial.call(ui);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.deepEqual(openedModes, ["runStart", "runStart"]);

  dismissed = true;
  GameUi.prototype.handleEvent.call(ui, { type: "runStarted", detail: {} });
  ui.game.phase = "playing";
  GameUi.prototype.scheduleRunTutorial.call(ui);
  await new Promise((resolve) => queueMicrotask(resolve));
  assert.equal(openedModes.length, 2);
});

test("glossary is a dedicated screen rather than a tutorial topic", () => {
  const openGlossary = actionBranch("open-glossary", "open-credits");
  const glossaryScreen = uiSource.indexOf('data-screen="glossary"');
  const glossaryStart = uiSource.lastIndexOf("<section", glossaryScreen);
  const glossaryEnd = uiSource.indexOf('data-screen="tutorial"', glossaryStart);
  const glossary = uiSource.slice(glossaryStart, glossaryEnd);
  assert.match(openGlossary, /this\.renderGlossary\(\)/);
  assert.match(openGlossary, /this\.openMenuOverlay\("glossary", button\)/);
  assert.match(glossary, /class="modal menu-modal glossary-modal hidden"/);
  assert.match(glossary, /data-glossary-content/);
  assert.doesNotMatch(glossary, /tutorial-topic|data-tutorial/);
  assert.match(uiSource, /for \(const \[sectionIndex, glossarySection\] of GLOSSARY_SECTIONS\.entries\(\)\)/);
});
