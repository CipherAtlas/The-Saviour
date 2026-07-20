import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uiSource = readFileSync(new URL("../src/ui/GameUi.js", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../src/main.js", import.meta.url), "utf8");
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("bookends retain the full-screen layered VN presentation", () => {
  assert.match(uiSource, /class="modal vn-screen hidden" data-screen="bookend"/);
  assert.match(uiSource, /data-bookend="background"/);
  for (const stage of ["left", "center-left", "center", "right"]) {
    assert.match(uiSource, new RegExp(`data-vn-stage="${stage}"`));
  }
  assert.match(uiSource, /bookendCharacterAsset\(detail\.artState\)/);
  assert.match(uiSource, /bookendBackgroundAsset\(detail\.background\)/);
  assert.match(styles, /\.vn-screen\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(styles, /\.vn-background\s*\{[^}]*object-fit:\s*cover/s);
});

test("bookends expose one accessible Continue action and no reader subsystem", () => {
  assert.match(uiSource, /data-action="bookend-continue"/);
  assert.match(uiSource, /data-bookend="input-hint"/);
  assert.doesNotMatch(uiSource, /dialogue-auto|dialogue-backlog|dialogue-fast-forward|dialogue-skip|glossary/i);
  assert.match(mainSource, /game\.continueBookend\(\)/);
  assert.match(mainSource, /consumePressed\("attack"\)/);
  assert.match(mainSource, /consumePressed\("interact"\)/);
  assert.match(styles, /\.reduced-motion \.vn-caret/);
  assert.match(styles, /\.high-contrast \.vn-dialogue-box/);
});

test("bookend art retains the outgoing composition until exact images decode", () => {
  assert.match(uiSource, /new BookendImageCache\(\)/);
  assert.match(uiSource, /Promise\.all\(\[/);
  assert.match(uiSource, /token !== this\.bookendArtToken \|\| this\.bookendArtBeatId !== detail\.beatId/);
  assert.match(uiSource, /if \(!outgoingArtReady\) this\.hideBookendArt\(\)/);
  assert.match(uiSource, /background\.replaceWith\(nextBackground\)/);
  assert.match(uiSource, /cutout\.replaceWith\(nextCutout\)/);
  assert.match(uiSource, /this\.bookendImageCache\.preload\(paths\)/);
});
