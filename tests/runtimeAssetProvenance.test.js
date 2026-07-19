import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { BIOMES } from "../src/generation/biomes.js";
import { BiomeRenderer, createProceduralDecalGeometry } from "../src/rendering/BiomeRenderer.js";

test("biomes expose distinct immutable procedural decal styles", () => {
  const styles = new Set();
  for (const biome of Object.values(BIOMES)) {
    assert.equal(Object.isFrozen(biome.decal), true);
    assert.equal(typeof biome.decal.color, "number");
    styles.add(biome.decal.style);
  }
  assert.equal(styles.size, Object.keys(BIOMES).length);
});

test("procedural biome decals are deterministic and visually distinct", () => {
  const fingerprints = new Set();
  for (const biome of Object.values(BIOMES)) {
    const first = createProceduralDecalGeometry(biome.decal.style, 3, 2.75);
    const second = createProceduralDecalGeometry(biome.decal.style, 3, 2.75);
    const positions = [...first.getAttribute("position").array];
    assert.deepEqual(positions, [...second.getAttribute("position").array]);
    assert.ok(positions.length >= 72);
    assert.ok(first.index.count >= 36);
    assert.ok(first.boundingSphere.radius > 0.5);
    fingerprints.add(JSON.stringify(positions));
    first.dispose();
    second.dispose();
  }
  assert.equal(fingerprints.size, Object.keys(BIOMES).length);
});

test("room decal allocations are capped and explicitly disposed", () => {
  const scene = new THREE.Scene();
  const renderer = new BiomeRenderer(scene, {});
  const props = Array.from({ length: 12 }, (_, index) => ({
    x: index,
    z: -index,
    rotation: index * 0.2,
    decalIndex: index % 8,
  }));
  renderer.addDecals(props, BIOMES.emberFoundry.decal);

  assert.equal(renderer.roomGeometries.size, 7);
  assert.equal(renderer.roomMaterials.size, 1);
  assert.equal(renderer.group.children.length, 7);
  assert.ok(renderer.group.children.every((decal) => decal.name === "procedural-decal:foundry-vent"));

  let geometryDisposals = 0;
  let materialDisposals = 0;
  for (const geometry of renderer.roomGeometries) geometry.addEventListener("dispose", () => { geometryDisposals += 1; });
  for (const material of renderer.roomMaterials) material.addEventListener("dispose", () => { materialDisposals += 1; });
  renderer.disposeRoomResources();
  assert.equal(geometryDisposals, 7);
  assert.equal(materialDisposals, 1);
  assert.equal(renderer.roomGeometries.size, 0);
  assert.equal(renderer.roomMaterials.size, 0);
});

test("walkable floor tops align to the actor ground plane", () => {
  const renderer = new BiomeRenderer(new THREE.Scene(), {});
  const template = {
    modelKey: "floor-grate",
    parts: [],
    size: new THREE.Vector3(4, 1.05, 4),
    minY: -1,
    maxY: 0.05,
  };
  renderer.templates.set(template.modelKey, template);
  let transforms = null;
  renderer.addInstancedModel = (_template, nextTransforms) => {
    transforms = nextTransforms;
  };

  renderer.addFloor(
    { width: 4, depth: 4 },
    { floorModel: template.modelKey },
  );

  assert.equal(transforms.length, 1);
  assert.equal(transforms[0].y + template.maxY, 0);
  assert.ok(transforms[0].y + template.minY < 0);
});
