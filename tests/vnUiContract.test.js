import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("VN presentation is full-screen layered art rather than legacy panel or inline dialogue", () => {
  assert.match(uiSource, /class="modal vn-screen hidden"/);
  assert.match(uiSource, /data-dialogue="background"/);
  assert.match(uiSource, /data-vn-stage="left"/);
  assert.match(uiSource, /data-vn-stage="center-left"/);
  assert.match(uiSource, /data-vn-stage="center"/);
  assert.match(uiSource, /data-vn-stage="right"/);
  assert.match(uiSource, /characterArtAsset\(detail\.artState\)/);
  assert.match(uiSource, /narrativeBackgroundAsset\(detail\.background\)/);
  assert.doesNotMatch(uiSource, /inline-dialogue|renderInlineDialogue|dialogue-panel/);
  assert.match(styles, /\.vn-screen\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.vn-background\s*\{[^}]*object-fit:\s*cover/s);
});

test("VN controls cover reader modes, focus containment, accessible restore, and bounded history", () => {
  for (const action of [
    "dialogue-continue",
    "dialogue-auto",
    "dialogue-backlog",
    "dialogue-hide",
    "dialogue-show-ui",
    "dialogue-fast-forward",
    "dialogue-skip-request",
    "dialogue-skip-confirm",
    "dialogue-skip-cancel",
  ]) {
    assert.match(uiSource, new RegExp(`data-action=["']${action}["']`));
  }
  assert.match(uiSource, /event\.key === "Tab"/);
  assert.match(uiSource, /DIALOGUE_HISTORY_RENDER_LIMIT = 120/);
  assert.match(styles, /\.reduced-motion \.vn-caret/);
  assert.match(styles, /\.high-contrast \.vn-dialogue-box/);
  assert.match(styles, /@media \(pointer: coarse\), \(max-width: 760px\)/);
});

test("keyboard, controller, and touch-facing actions use the same reader commands without combat bleed", () => {
  assert.doesNotMatch(uiSource, /event\.key\.toLowerCase\(\) === "[abhfs]"/);
  assert.doesNotMatch(uiSource, /\["Enter", " "\]\.includes\(event\.key\)/);
  assert.match(mainSource, /consumePressed\("attack"\)/);
  assert.match(mainSource, /consumePressed\("interact"\)/);
  assert.match(mainSource, /consumePressed\("heavy"\)/);
  assert.match(mainSource, /consumePressed\("dash"\)/);
  assert.match(mainSource, /consumePressed\("moveUp"\)/);
  assert.match(mainSource, /consumePressed\("moveDown"\)/);
  assert.match(mainSource, /consumePressed\("pause"\)/);
  assert.match(mainSource, /input\.isDown\("claim"\)/);
  assert.match(mainSource, /game\.confirmDialogueSkip/);
  assert.match(mainSource, /game\.cancelDialogueOverlay/);
  assert.match(mainSource, /game\.togglePause\(pauseInput\.timeStamp\)/);
  assert.match(mainSource, /input\.flushActions\(\["attack", "interact", "heavy", "dash", "moveUp", "moveDown", "claim", "pause"\]\)/);
  assert.match(uiSource, /data-dialogue="input-hint"/);
});

test("VN art keeps the outgoing composition until exact staging images decode", () => {
  assert.match(uiSource, /maxEntries: NARRATIVE_SCENE_IMAGE_CACHE_LIMIT/);
  assert.match(uiSource, /Promise\.all\(\[/);
  assert.match(uiSource, /token !== this\.dialogueArtToken \|\| this\.dialogueArtBeatId !== detail\.beatId/);
  assert.match(uiSource, /if \(!outgoingArtReady\) this\.hideDialogueArt\(\)/);
  assert.match(uiSource, /background\.replaceWith\(nextBackground\)/);
  assert.match(uiSource, /cutout\.replaceWith\(nextCutout\)/);
  assert.match(uiSource, /this\.game\.dialogue\.sequence\(detail\.sequenceId\)/);
  assert.match(uiSource, /this\.dialogueImageCache\.preloadScene\(paths\)/);
});
