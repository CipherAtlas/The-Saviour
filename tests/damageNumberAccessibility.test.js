import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { formatDamageNumberText } from "../src/rendering/DamageNumberLayer.js";

test("five priority meanings remain explicit without color", () => {
  assert.match(formatDamageNumberText("blocked", 8), /BLOCK/);
  assert.match(formatDamageNumberText("critical", 8), /✦ CRIT/);
  assert.match(formatDamageNumberText("player", 8), /▼ −/);
  assert.match(formatDamageNumberText("heal", 8), /✚ \+/);
  assert.match(formatDamageNumberText("revive", 8), /◉ REVIVE/);
});

test("overlay and CSS retain presentation semantics, palettes, contrast, and reduced motion", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(html, /<canvas id="game-canvas"[^>]*><\/canvas>\s*<div id="combat-overlay" role="presentation" aria-hidden="true"><\/div>\s*<div id="ui"/);
  assert.match(css, /#combat-overlay/);
  assert.match(css, /pointer-events:\s*none/);
  assert.match(css, /data-taxonomy="blocked"/);
  assert.match(css, /data-taxonomy="critical"/);
  assert.match(css, /data-taxonomy="player"/);
  assert.match(css, /data-taxonomy="heal"/);
  assert.match(css, /data-taxonomy="revive"/);
  assert.match(css, /data-contrast="high"/);
  assert.match(css, /data-palette="deuteranopia"/);
  assert.match(css, /data-palette="tritanopia"/);
  assert.match(css, /body\.reduced-motion #combat-overlay/);
});
