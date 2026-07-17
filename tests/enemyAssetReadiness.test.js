import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { EnemyCharacterRenderer } from "../src/rendering/EnemyCharacterRenderer.js";
import { getEnemyVisualProfile } from "../src/rendering/enemyVisualProfiles.js";

function createRenderer() {
  const scene = new THREE.Scene();
  const player = new THREE.Group();
  player.name = "player-actor";
  scene.add(player);

  const renderer = new EnemyCharacterRenderer(scene, {});
  const template = new THREE.Group();
  template.add(new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 1.8, 0.5),
    new THREE.MeshStandardMaterial(),
  ));
  renderer.assets.set("minion", { scene: template, animations: [] });
  return renderer;
}

function thrall(id, x = 1) {
  return {
    id,
    type: "thrall",
    active: true,
    position: { x, z: 1 },
    previousPosition: { x, z: 1 },
    facing: { x: 0, z: 1 },
    maxHealth: 10,
    health: 10,
    hitFlash: 0,
    state: "chase",
    attackPending: false,
    attackKind: null,
  };
}

test("new chamber enemies present a readable silhouette throughout their awaken rise", () => {
  const renderer = createRenderer();
  const enemy = thrall(1);

  renderer.sync([enemy], 1, 0);
  const actor = renderer.actors.get(enemy.id);
  assert.equal(actor.root.visible, true);
  assert.ok(actor.root.scale.x >= 0.94);
  assert.ok(actor.root.scale.y >= 0.86);
  assert.ok(actor.root.position.y < 0, "the awaken begins with a shallow rise from the floor");
  assert.equal(renderer.resolveAnimation(actor, enemy, false).key, "spawn");

  renderer.sync([enemy], 1, 0.28);
  assert.ok(actor.root.scale.y > 1, "the awaken briefly overshoots full height");
  assert.ok(actor.root.position.y > -0.16 && actor.root.position.y < 0);

  renderer.sync([enemy], 1, 0.28);
  assert.deepEqual(actor.root.scale.toArray(), [1, 1, 1]);
  assert.equal(actor.root.position.y, 0);
});

test("normal chambers render every active enemy with its main animated rig", () => {
  const renderer = createRenderer();
  renderer.createProxyMeshes();
  const enemies = Array.from({ length: 12 }, (_, index) => thrall(index + 1, 10 + index));

  renderer.sync(enemies, 1, 1 / 60);

  assert.deepEqual(renderer.detailedIds, new Set(enemies.map((enemy) => enemy.id)));
  assert.ok([...renderer.actors.values()].every((record) => record.detailed && record.root.visible));
  assert.equal(renderer.proxyMeshes.get("thrall").count, 0);
});

test("new distant enemies keep a readable proxy silhouette on their first frame", () => {
  const renderer = createRenderer();
  renderer.createProxyMeshes();
  const enemy = thrall(1, 20);

  renderer.sync([enemy], 1, 0, { allowProxies: true });

  const proxy = renderer.proxyMeshes.get("thrall");
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  proxy.getMatrixAt(0, matrix);
  matrix.decompose(position, rotation, scale);
  const profileScale = getEnemyVisualProfile("thrall").scale;
  assert.equal(proxy.count, 1);
  assert.ok(scale.x / profileScale >= 0.94);
  assert.ok(scale.y / profileScale >= 0.84);
  assert.ok(position.y < 0 && position.y >= -0.16);
});

test("same-size chamber replacement releases stale actors before acquiring new ids", () => {
  const renderer = createRenderer();
  const firstChamber = [thrall(1, 0), thrall(2, 1), thrall(3, 2)];
  const nextChamber = [thrall(101, 0), thrall(102, 1), thrall(103, 2)];

  renderer.sync(firstChamber, 1, 1 / 60);
  const createdAfterFirstChamber = renderer.createdActors;
  const firstRecords = new Set(renderer.actors.values());

  renderer.sync(nextChamber, 1, 1 / 60);

  assert.equal(createdAfterFirstChamber, 3);
  assert.equal(renderer.createdActors, createdAfterFirstChamber);
  assert.equal(renderer.actors.size, nextChamber.length);
  assert.ok([...renderer.actors.values()].every((record) => firstRecords.has(record)));
  assert.equal(renderer.freeByType.get("thrall")?.length ?? 0, 0);
});
