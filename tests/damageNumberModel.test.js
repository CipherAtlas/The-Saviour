import assert from "node:assert/strict";
import test from "node:test";
import {
  DAMAGE_NUMBER_STYLES,
  damageNumberModel,
  formatDamageNumberText,
} from "../src/rendering/DamageNumberLayer.js";

test("damage-number taxonomy prioritizes block over critical and rounds accepted damage", () => {
  const base = {
    type: "enemyHit",
    detail: { id: 7, type: "boneguard", damage: 12.6, critical: true, blocked: true, position: { x: 2, z: 3 } },
  };
  const blocked = damageNumberModel(base);
  assert.equal(blocked.taxonomy, "blocked");
  assert.equal(blocked.amount, 13);
  assert.equal(blocked.targetId, "enemy:7");
  assert.equal(blocked.y, 3.2);
  assert.equal(blocked.lifetime, DAMAGE_NUMBER_STYLES.blocked.lifetime);

  const critical = damageNumberModel({ ...base, detail: { ...base.detail, blocked: false } });
  assert.equal(critical.taxonomy, "critical");
  const normal = damageNumberModel({ ...base, detail: { ...base.detail, blocked: false, critical: false } });
  assert.equal(normal.taxonomy, "normal");
});

test("player damage, healing, and revival require finite canonical event data", () => {
  const player = damageNumberModel({
    type: "playerHit",
    detail: { amount: 9.5, appliedAmount: 7.6, position: { x: 0, z: 1 }, direction: { x: -1, z: 0 } },
  });
  assert.equal(player.taxonomy, "player");
  assert.equal(player.amount, 8);
  assert.equal(player.y, 2.75);
  assert.equal(player.directionX, -1);

  const heal = damageNumberModel({
    type: "playerHealed",
    detail: { healingId: "heal-1", targetId: "player", amount: 11.2, reason: "kill", position: { x: 1, z: 2 } },
  });
  assert.equal(heal.taxonomy, "heal");
  assert.equal(heal.amount, 11);

  const revive = damageNumberModel({
    type: "playerHealed",
    detail: { healingId: "heal-2", targetId: "player", amount: 49, reason: "deathDefiance", position: { x: 1, z: 2 } },
  });
  assert.equal(revive.taxonomy, "revive");

  for (const event of [
    { type: "enemyBlock", detail: { damage: 10, position: { x: 0, z: 0 } } },
    { type: "enemyPoiseChanged", detail: { amount: 10, position: { x: 0, z: 0 } } },
    { type: "perfectDash", detail: { amount: 10, position: { x: 0, z: 0 } } },
    { type: "playerHealed", detail: { amount: 10, targetId: "player", position: { x: 0, z: 0 } } },
    { type: "enemyHit", detail: { id: 1, type: "thrall", damage: 0, position: { x: 0, z: 0 } } },
    { type: "playerHit", detail: { amount: Number.NaN, position: { x: 0, z: 0 } } },
  ]) assert.equal(damageNumberModel(event), null);
});

test("all combat meanings have explicit non-color text", () => {
  assert.equal(formatDamageNumberText("normal", 10), "−10");
  assert.equal(formatDamageNumberText("blocked", 10), "[ BLOCK ]");
  assert.equal(formatDamageNumberText("critical", 10), "✦ CRIT −10");
  assert.equal(formatDamageNumberText("player", 10), "▼ −10");
  assert.equal(formatDamageNumberText("heal", 10), "✚ +10");
  assert.equal(formatDamageNumberText("revive", 10), "◉ REVIVE +10");
  assert.equal(formatDamageNumberText("normal", 20, 3), "−20 ×3");
  assert.equal(formatDamageNumberText("normal", 0), null);
});

test("priority tiers preserve player readability and critical-heal precedence", () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(DAMAGE_NUMBER_STYLES).map(([key, value]) => [key, value.priority])),
    { normal: 1, critical: 4, blocked: 2, player: 5, heal: 4, revive: 5 },
  );
});
