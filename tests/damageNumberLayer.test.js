import assert from "node:assert/strict";
import test from "node:test";
import {
  DAMAGE_NUMBER_CAPACITY,
  DAMAGE_NUMBER_STYLES,
  DamageNumberLayer,
} from "../src/rendering/DamageNumberLayer.js";
import { GameRenderer } from "../src/rendering/GameRenderer.js";

class FakeNode {
  constructor() {
    this.children = [];
    this.dataset = {};
    this.style = { opacity: "", transform: "", setProperty(name, value) { this[name] = value; } };
    this.className = "";
    this.textContent = "";
  }
  append(...nodes) {
    for (const node of nodes) {
      if (node.isFragment) this.children.push(...node.children);
      else this.children.push(node);
    }
  }
}

function installFakeDocument() {
  const previous = globalThis.document;
  let created = 0;
  globalThis.document = {
    createElement() { created += 1; return new FakeNode(); },
    createDocumentFragment() { const node = new FakeNode(); node.isFragment = true; return node; },
  };
  return { restore: () => { globalThis.document = previous; }, created: () => created };
}

function createLayer() {
  const fake = installFakeDocument();
  const root = new FakeNode();
  const canvas = {
    clientWidth: 800,
    clientHeight: 600,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  };
  const layer = new DamageNumberLayer(root, canvas, {
    gameplay: { damageNumbers: true },
    accessibility: { uiScale: 1, highContrast: false, colorPalette: "default" },
    camera: { reducedMotion: false },
  });
  return { fake, root, layer };
}

function model(overrides = {}) {
  const taxonomy = overrides.taxonomy ?? "normal";
  return {
    taxonomy,
    amount: overrides.amount ?? 10,
    count: overrides.count ?? 1,
    targetId: overrides.targetId ?? "enemy:1",
    eventId: overrides.eventId ?? null,
    reason: overrides.reason ?? null,
    x: overrides.x ?? 0,
    y: overrides.y ?? 2.5,
    z: overrides.z ?? 0,
    directionX: overrides.directionX ?? 0,
    directionZ: overrides.directionZ ?? 0,
    lifetime: DAMAGE_NUMBER_STYLES[taxonomy].lifetime,
    priority: DAMAGE_NUMBER_STYLES[taxonomy].priority,
    deferAcrossArena: overrides.deferAcrossArena ?? false,
  };
}

test("the layer creates exactly 48 nodes and 48 reusable records once", () => {
  const { fake, root, layer } = createLayer();
  try {
    assert.equal(fake.created(), DAMAGE_NUMBER_CAPACITY);
    assert.equal(root.children.length, DAMAGE_NUMBER_CAPACITY);
    assert.equal(layer.records.length, DAMAGE_NUMBER_CAPACITY);
    for (let index = 0; index < 80; index += 1) layer.spawn(model({ targetId: `enemy:${index}` }));
    assert.equal(fake.created(), DAMAGE_NUMBER_CAPACITY);
    assert.equal(root.children.length, DAMAGE_NUMBER_CAPACITY);
    assert.equal(layer.metrics().domNodes, DAMAGE_NUMBER_CAPACITY);
    assert.ok(layer.metrics().active <= DAMAGE_NUMBER_CAPACITY);
  } finally { fake.restore(); }
});

test("the renderer benchmark scenario deterministically reaches all 48 nodes with every taxonomy", () => {
  const { fake, root, layer } = createLayer();
  try {
    const renderer = Object.create(GameRenderer.prototype);
    renderer.damageNumbers = layer;
    const enemies = Array.from({ length: 35 }, (_, index) => ({
      id: index + 1,
      type: "thrall",
      position: { x: index % 7, z: Math.floor(index / 7) },
    }));
    const metrics = renderer.saturateDamageNumbersForBenchmark({
      director: { enemies },
      player: { position: { x: 0, z: 0 } },
    });

    assert.deepEqual(metrics, {
      active: 48,
      capacity: 48,
      peak: 48,
      dropped: 0,
      replaced: 0,
      aggregated: 1,
      domNodes: 48,
      projected: 0,
    });
    assert.deepEqual(
      new Set(layer.records.filter(({ active }) => active).map(({ taxonomy }) => taxonomy)),
      new Set(["normal", "critical", "blocked", "player", "heal", "revive"]),
    );
    assert.equal(fake.created(), DAMAGE_NUMBER_CAPACITY);
    assert.equal(root.children.length, DAMAGE_NUMBER_CAPACITY);
  } finally { fake.restore(); }
});

test("aggregation is target-and-taxonomy local with summed text, count, and deterministic lanes", () => {
  const { fake, layer } = createLayer();
  try {
    layer.spawn(model({ targetId: "enemy:A", amount: 10 }));
    layer.spawn(model({ targetId: "enemy:A", amount: 7 }));
    layer.spawn(model({ targetId: "enemy:B", amount: 5 }));
    layer.spawn(model({ targetId: "enemy:A", taxonomy: "critical", amount: 8 }));
    assert.equal(layer.metrics().active, 3);
    assert.equal(layer.metrics().aggregated, 1);
    const normalA = layer.records.find((record) => record.active && record.targetId === "enemy:A" && record.taxonomy === "normal");
    const normalB = layer.records.find((record) => record.active && record.targetId === "enemy:B");
    const criticalA = layer.records.find((record) => record.active && record.taxonomy === "critical");
    assert.equal(normalA.amount, 17);
    assert.equal(normalA.count, 2);
    assert.equal(normalA.node.textContent, "−17 ×2");
    assert.equal(normalA.lane, 0);
    assert.equal(normalB.lane, 0);
    assert.equal(criticalA.lane, 1);
  } finally { fake.restore(); }
});

test("a full pool drops early low priority and replaces only higher or half-finished equals", () => {
  const { fake, layer } = createLayer();
  try {
    for (let index = 0; index < DAMAGE_NUMBER_CAPACITY; index += 1) {
      assert.equal(layer.spawn(model({ targetId: `enemy:${index}` })), true);
    }
    assert.equal(layer.spawn(model({ targetId: "enemy:drop" })), false);
    assert.equal(layer.metrics().dropped, 1);
    assert.equal(layer.spawn(model({ targetId: "enemy:critical", taxonomy: "critical" })), true);
    assert.equal(layer.metrics().replaced, 1);
    for (const record of layer.records) {
      if (record.priority === DAMAGE_NUMBER_STYLES.normal.priority) record.elapsed = record.lifetime * 0.5;
    }
    assert.equal(layer.spawn(model({ targetId: "enemy:equal" })), true);
    assert.equal(layer.metrics().replaced, 2);
    assert.equal(layer.metrics().active, DAMAGE_NUMBER_CAPACITY);
  } finally { fake.restore(); }
});

test("player and revive records resist lower tiers while critical and heal replace the oldest low tier", () => {
  const { fake, layer } = createLayer();
  try {
    for (let index = 0; index < DAMAGE_NUMBER_CAPACITY; index += 1) {
      layer.spawn(model({ targetId: `enemy:low-${index}` }));
    }
    assert.equal(layer.records[0].serial, 1);
    assert.equal(layer.spawn(model({ targetId: "enemy:critical", taxonomy: "critical" })), true);
    assert.equal(layer.records[0].taxonomy, "critical");
    assert.equal(layer.spawn(model({ targetId: "player", taxonomy: "heal" })), true);
    assert.equal(layer.records[1].taxonomy, "heal");
    assert.equal(layer.metrics().replaced, 2);

    layer.clear(true);
    for (let index = 0; index < DAMAGE_NUMBER_CAPACITY; index += 1) {
      const taxonomy = index % 2 === 0 ? "player" : "revive";
      layer.spawn(model({ targetId: `${taxonomy}:${index}`, taxonomy }));
    }
    for (const taxonomy of ["critical", "heal", "blocked", "normal"]) {
      assert.equal(layer.spawn(model({ targetId: `incoming:${taxonomy}`, taxonomy })), false);
    }
    assert.equal(layer.metrics().active, DAMAGE_NUMBER_CAPACITY);
    assert.ok(layer.records.every(({ taxonomy }) => taxonomy === "player" || taxonomy === "revive"));
  } finally { fake.restore(); }
});

test("pause and hit-stop freeze lifetime while normal updates release at bounded residence", () => {
  const { fake, root, layer } = createLayer();
  try {
    layer.spawn(model());
    const record = layer.records[0];
    layer.projectedVector = { set: () => ({ project: () => ({ x: 0, y: 0, z: 0 }) }) };
    layer.update(0.4, {}, { phase: "paused", hitStopActive: false });
    assert.equal(root.hidden, true);
    layer.update(0.4, {}, { phase: "playing", hitStopActive: true });
    assert.equal(root.hidden, false);
    assert.equal(record.elapsed, 0);
    assert.equal(record.node.style.opacity, "1");
    layer.update(record.lifetime, {}, { phase: "playing", hitStopActive: false });
    assert.equal(record.active, false);
    assert.equal(record.node.style.opacity, "0");
  } finally { fake.restore(); }
});

test("entering pause clears combat numbers so they cannot reappear on resume", () => {
  const { fake, root, layer } = createLayer();
  try {
    layer.spawn(model());
    layer.handleEvent({ type: "phaseChanged", detail: { phase: "paused" } });
    assert.equal(root.hidden, true);
    assert.equal(layer.metrics().active, 0);
    assert.ok(layer.records.every((record) => record.node.style.opacity === "0"));

    layer.handleEvent({ type: "phaseChanged", detail: { phase: "playing" } });
    assert.equal(root.hidden, false);
    assert.equal(layer.metrics().active, 0);
  } finally { fake.restore(); }
});

test("bookend and choice phases finish numbers while loading and terminal phases clear them", () => {
  const { fake, layer } = createLayer();
  try {
    layer.projectedVector = { set: () => ({ project: () => ({ x: 0, y: 0, z: 0 }) }) };
    for (const phase of ["bookend", "blessing"]) {
      layer.spawn(model({ targetId: `enemy:${phase}` }));
      layer.update(DAMAGE_NUMBER_STYLES.normal.lifetime, {}, { phase });
      assert.equal(layer.metrics().active, 0, `${phase} should finish the active number`);
    }
    for (const phase of [
      "roomLoading", "portalTraversal", "roomLoadError", "title", "dead",
      "endingChoice", "endingStrike", "endingFade", "endingComplete",
    ]) {
      layer.spawn(model({ targetId: `enemy:${phase}` }));
      layer.handleEvent({ type: "phaseChanged", detail: { phase } });
      assert.equal(layer.metrics().active, 0, `${phase} should clear the active number`);
    }
  } finally { fake.restore(); }
});

test("settings, reset phases, and one pending floor heal clear without replay", () => {
  const { fake, layer } = createLayer();
  try {
    layer.handleEvent({
      type: "playerHealed",
      detail: { healingId: "heal-floor", targetId: "player", amount: 12, reason: "floorRecovery", position: { x: 1, z: 2 } },
    });
    layer.handleEvent({ type: "arenaChanged", detail: {} });
    assert.equal(layer.metrics().active, 0);
    assert.equal(layer.pending.active, true);
    layer.handleEvent({ type: "phaseChanged", detail: { phase: "roomLoading" } });
    assert.equal(layer.pending.active, true);
    layer.handleEvent({ type: "roomReady", detail: {} }, { player: { position: { x: 4, z: 5 } } });
    assert.equal(layer.metrics().active, 1);
    assert.equal(layer.pending.active, false);
    layer.handleEvent({ type: "phaseChanged", detail: { phase: "title" } });
    assert.equal(layer.metrics().active, 0);
    layer.handleEvent({ type: "roomReady", detail: {} }, { player: { position: { x: 4, z: 5 } } });
    assert.equal(layer.metrics().active, 0);

    layer.spawn(model());
    layer.applySettings({ gameplay: { damageNumbers: false }, accessibility: { uiScale: 1 }, camera: {} });
    assert.equal(layer.metrics().active, 0);
    assert.equal(layer.pending.active, false);
  } finally { fake.restore(); }
});

test("live presentation settings update scale, palette, contrast, and reduced-motion displacement", () => {
  const { fake, root, layer } = createLayer();
  try {
    layer.applySettings({
      gameplay: { damageNumbers: true },
      accessibility: { uiScale: 1.35, highContrast: true, colorPalette: "tritanopia" },
      camera: { reducedMotion: true },
    });
    assert.equal(root.dataset.contrast, "high");
    assert.equal(root.dataset.palette, "tritanopia");
    assert.equal(root.style["--damage-ui-scale"], "1.35");
    assert.equal(layer.reducedMotion, true);

    layer.spawn(model({ taxonomy: "critical", directionX: 1 }));
    layer.projectedVector = { set: () => ({ project: () => ({ x: 0, y: 0, z: 0 }) }) };
    layer.update(0.3, {}, { phase: "playing" });
    assert.match(layer.records[0].node.style.transform, /scale\(1\.35\)$/);
    const translatedY = Number(layer.records[0].node.style.transform.match(/translate3d\([^,]+, ([\d.]+)px/)[1]);
    assert.ok(translatedY >= 292 && translatedY <= 308);
  } finally { fake.restore(); }
});
