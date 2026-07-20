import * as THREE from "three";
import { getBiome } from "../generation/biomes.js";
import {
  getPerimeterWallSegments,
  getWalkableRegions,
  isPointWalkable,
} from "../game/arenaGeometry.js";

function groupByModel(entries) {
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.modelKey)) grouped.set(entry.modelKey, []);
    grouped.get(entry.modelKey).push(entry);
  }
  return grouped;
}

function collectMeshes(scene) {
  const result = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!object.isMesh) return;
    result.push({
      geometry: object.geometry,
      material: Array.isArray(object.material) ? object.material[0] : object.material,
      matrix: object.matrixWorld.clone(),
    });
  });
  return result;
}

const MAX_DECALS_PER_ROOM = 7;

function ascendingUnique(values) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function regionEdges(region) {
  return {
    minX: region.x - region.width / 2,
    maxX: region.x + region.width / 2,
    minZ: region.z - region.depth / 2,
    maxZ: region.z + region.depth / 2,
  };
}

/**
 * Partition the region union into non-overlapping model-sized floor pieces.
 * Keeping this data-only makes the rendered footprint directly testable.
 */
export function createShapedFloorPieces(arena, tileWidth, tileDepth) {
  if (!(tileWidth > 0) || !(tileDepth > 0)) throw new RangeError("Floor tile dimensions must be positive.");
  const regions = getWalkableRegions(arena);
  const xEdges = ascendingUnique(regions.flatMap((entry) => {
    const bounds = regionEdges(entry);
    return [bounds.minX, bounds.maxX];
  }));
  const zEdges = ascendingUnique(regions.flatMap((entry) => {
    const bounds = regionEdges(entry);
    return [bounds.minZ, bounds.maxZ];
  }));
  const pieces = [];

  for (let xIndex = 0; xIndex < xEdges.length - 1; xIndex += 1) {
    const cellMinX = xEdges[xIndex];
    const cellMaxX = xEdges[xIndex + 1];
    for (let zIndex = 0; zIndex < zEdges.length - 1; zIndex += 1) {
      const cellMinZ = zEdges[zIndex];
      const cellMaxZ = zEdges[zIndex + 1];
      if (!isPointWalkable(arena, {
        x: (cellMinX + cellMaxX) / 2,
        z: (cellMinZ + cellMaxZ) / 2,
      })) continue;

      const columns = Math.max(1, Math.ceil((cellMaxX - cellMinX) / tileWidth));
      const rows = Math.max(1, Math.ceil((cellMaxZ - cellMinZ) / tileDepth));
      const width = (cellMaxX - cellMinX) / columns;
      const depth = (cellMaxZ - cellMinZ) / rows;
      for (let column = 0; column < columns; column += 1) {
        for (let row = 0; row < rows; row += 1) {
          pieces.push(Object.freeze({
            x: cellMinX + (column + 0.5) * width,
            z: cellMinZ + (row + 0.5) * depth,
            width,
            depth,
          }));
        }
      }
    }
  }
  return Object.freeze(pieces);
}

export function createPerimeterWallPieces(arena, maximumLength) {
  if (!(maximumLength > 0)) throw new RangeError("Wall piece length must be positive.");
  const pieces = [];
  for (const segment of getPerimeterWallSegments(arena)) {
    const count = Math.max(1, Math.ceil(segment.length / maximumLength));
    const length = segment.length / count;
    const dx = (segment.end.x - segment.start.x) / segment.length;
    const dz = (segment.end.z - segment.start.z) / segment.length;
    for (let index = 0; index < count; index += 1) {
      const distance = (index + 0.5) * length;
      pieces.push(Object.freeze({
        perimeterId: segment.id,
        x: segment.start.x + dx * distance,
        z: segment.start.z + dz * distance,
        length,
        rotation: Math.atan2(-segment.normal.x, -segment.normal.z),
        normal: segment.normal,
      }));
    }
  }
  return Object.freeze(pieces);
}

function appendRibbon(positions, indices, start, end, width) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz) || 1;
  const sideX = (-dz / length) * width * 0.5;
  const sideZ = (dx / length) * width * 0.5;
  const first = positions.length / 3;
  positions.push(
    start.x + sideX, 0, start.z + sideZ,
    start.x - sideX, 0, start.z - sideZ,
    end.x - sideX, 0, end.z - sideZ,
    end.x + sideX, 0, end.z + sideZ,
  );
  indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

function appendRing(positions, indices, radius, width, segments = 20, startAngle = 0, arc = Math.PI * 2) {
  for (let segment = 0; segment < segments; segment += 1) {
    const angleA = startAngle + (segment / segments) * arc;
    const angleB = startAngle + ((segment + 1) / segments) * arc;
    const outer = radius + width * 0.5;
    const inner = Math.max(0, radius - width * 0.5);
    const first = positions.length / 3;
    positions.push(
      Math.cos(angleA) * outer, 0, Math.sin(angleA) * outer,
      Math.cos(angleA) * inner, 0, Math.sin(angleA) * inner,
      Math.cos(angleB) * inner, 0, Math.sin(angleB) * inner,
      Math.cos(angleB) * outer, 0, Math.sin(angleB) * outer,
    );
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }
}

function appendPolygon(positions, indices, radius, sides, width, rotation = 0) {
  for (let side = 0; side < sides; side += 1) {
    const angleA = rotation + (side / sides) * Math.PI * 2;
    const angleB = rotation + ((side + 1) / sides) * Math.PI * 2;
    appendRibbon(
      positions,
      indices,
      { x: Math.cos(angleA) * radius, z: Math.sin(angleA) * radius },
      { x: Math.cos(angleB) * radius, z: Math.sin(angleB) * radius },
      width,
    );
  }
}

export function createProceduralDecalGeometry(style, variant, size) {
  const positions = [];
  const indices = [];
  const radius = size * 0.38;
  const stroke = Math.max(0.045, size * 0.035);
  const phase = (Math.abs(variant) % 8) * Math.PI / 8;

  if (style === "keep-ward") {
    appendPolygon(positions, indices, radius, 4, stroke, Math.PI / 4);
    appendRibbon(positions, indices, { x: -radius * 0.72, z: 0 }, { x: radius * 0.72, z: 0 }, stroke);
    appendRibbon(positions, indices, { x: 0, z: -radius * 0.72 }, { x: 0, z: radius * 0.72 }, stroke);
    appendPolygon(positions, indices, radius * 0.38, 4, stroke * 0.8, phase);
  } else if (style === "ossuary-reliquary") {
    appendRing(positions, indices, radius * 0.48, stroke, 18);
    appendRibbon(positions, indices, { x: -radius * 0.86, z: -radius * 0.55 }, { x: radius * 0.86, z: radius * 0.55 }, stroke * 1.2);
    appendRibbon(positions, indices, { x: -radius * 0.86, z: radius * 0.55 }, { x: radius * 0.86, z: -radius * 0.55 }, stroke * 1.2);
    for (const angle of [phase, phase + Math.PI]) {
      const x = Math.cos(angle) * radius * 0.48;
      const z = Math.sin(angle) * radius * 0.48;
      appendRing(positions, indices, stroke * 1.5, stroke, 10, 0, Math.PI * 2);
      const vertexStart = positions.length - 10 * 4 * 3;
      for (let index = vertexStart; index < positions.length; index += 3) {
        positions[index] += x;
        positions[index + 2] += z;
      }
    }
  } else if (style === "foundry-vent") {
    appendRing(positions, indices, radius * 0.72, stroke * 1.25, 18, phase, Math.PI * 1.7);
    appendRing(positions, indices, radius * 0.36, stroke, 14, -phase, Math.PI * 1.55);
    for (let spoke = 0; spoke < 4; spoke += 1) {
      const angle = phase + spoke * Math.PI / 2;
      appendRibbon(
        positions,
        indices,
        { x: Math.cos(angle) * radius * 0.12, z: Math.sin(angle) * radius * 0.12 },
        { x: Math.cos(angle) * radius * 0.9, z: Math.sin(angle) * radius * 0.9 },
        stroke * 1.15,
      );
    }
  } else if (style === "void-rune") {
    appendPolygon(positions, indices, radius * 0.9, 3, stroke, phase);
    appendPolygon(positions, indices, radius * 0.56, 3, stroke * 0.85, -phase - Math.PI / 3);
    appendRing(positions, indices, radius * 0.24, stroke, 12, phase, Math.PI * 1.5);
    appendRibbon(positions, indices, { x: -radius * 0.12, z: -radius * 0.94 }, { x: radius * 0.12, z: radius * 0.94 }, stroke * 0.8);
  } else {
    throw new RangeError(`Unknown procedural decal style: ${style}`);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

export class BiomeRenderer {
  constructor(scene, catalog) {
    this.catalog = catalog;
    this.group = new THREE.Group();
    this.group.name = "biome-world";
    scene.add(this.group);
    this.templates = new Map();
    this.buildToken = 0;
    this.roomGeometries = new Set();
    this.roomMaterials = new Set();
  }

  async build(arena) {
    const token = ++this.buildToken;
    const biome = getBiome(arena.environmentTheme ?? arena.biome);
    this.group.visible = false;
    await this.catalog.preloadBiome(biome.id);
    const modelKeys = [
      biome.floorModel,
      biome.wallModel,
      ...arena.obstacles.map((obstacle) => obstacle.modelKey),
      ...(arena.props ?? []).map((prop) => prop.modelKey),
    ];
    await this.cacheTemplates(modelKeys);
    if (token !== this.buildToken) return;
    this.disposeRoomResources();
    this.group.clear();
    this.addFloor(arena, biome);
    this.addWalls(arena, biome);
    this.addObstacles(arena);
    this.addProps(arena.props ?? []);
    this.addDecals(arena.props ?? [], biome.decal);
    if (token === this.buildToken) this.group.visible = true;
  }

  addFloor(arena, biome) {
    const template = this.template(biome.floorModel);
    const tileWidth = Math.max(1, template.size.x);
    const tileDepth = Math.max(1, template.size.z);
    const transforms = createShapedFloorPieces(arena, tileWidth, tileDepth).map((piece) => ({
      x: piece.x,
      y: -template.maxY,
      z: piece.z,
      rotation: 0,
      scaleX: piece.width / Math.max(0.25, template.size.x),
      scaleY: 1,
      scaleZ: piece.depth / Math.max(0.25, template.size.z),
    }));
    this.addInstancedModel(template, transforms, { castShadow: false, receiveShadow: true });
  }

  addWalls(arena, biome) {
    const template = this.template(biome.wallModel);
    const segment = Math.max(2, template.size.x);
    const transforms = createPerimeterWallPieces(arena, segment).map((piece) => ({
      x: piece.x,
      y: -template.minY,
      z: piece.z,
      rotation: piece.rotation,
      scaleX: piece.length / Math.max(0.25, template.size.x),
      scaleY: 1,
      scaleZ: 1,
    }));
    this.addInstancedModel(template, transforms, { castShadow: true, receiveShadow: true });
  }

  addObstacles(arena) {
    for (const [modelKey, obstacles] of groupByModel(arena.obstacles)) {
      const template = this.template(modelKey);
      const transforms = obstacles.map((obstacle) => {
        const scaleX = obstacle.width / Math.max(0.25, template.size.x);
        const scaleY = obstacle.height / Math.max(0.25, template.size.y);
        const scaleZ = obstacle.depth / Math.max(0.25, template.size.z);
        return {
          x: obstacle.x,
          y: -template.minY * scaleY,
          z: obstacle.z,
          rotation: 0,
          scaleX,
          scaleY,
          scaleZ,
        };
      });
      this.addInstancedModel(template, transforms, { castShadow: true, receiveShadow: true });
    }
  }

  addProps(props) {
    for (const [modelKey, entries] of groupByModel(props)) {
      const template = this.template(modelKey);
      const transforms = entries.map((prop) => ({
        x: prop.x,
        y: -template.minY * prop.scale,
        z: prop.z,
        rotation: prop.rotation,
        scaleX: prop.scale,
        scaleY: prop.scale,
        scaleZ: prop.scale,
      }));
      this.addInstancedModel(template, transforms, { castShadow: false, receiveShadow: true });
    }
  }

  addDecals(props, decalStyle) {
    const material = new THREE.MeshBasicMaterial({
      color: decalStyle.color,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.roomMaterials.add(material);
    for (const prop of props.slice(0, MAX_DECALS_PER_ROOM)) {
      const size = 2.2 + (prop.decalIndex % 3) * 0.55;
      const geometry = createProceduralDecalGeometry(decalStyle.style, prop.decalIndex, size);
      this.roomGeometries.add(geometry);
      const decal = new THREE.Mesh(geometry, material);
      decal.name = `procedural-decal:${decalStyle.style}`;
      decal.position.set(prop.x, 0.035, prop.z);
      decal.rotation.y = prop.rotation;
      decal.renderOrder = 2;
      this.group.add(decal);
    }
  }

  template(modelKey) {
    const template = this.templates.get(modelKey);
    if (!template) throw new Error(`Environment asset was not prepared: ${modelKey}`);
    return template;
  }

  cacheTemplates(modelKeys) {
    return Promise.all([...new Set(modelKeys)].map(async (modelKey) => {
      const gltf = await this.catalog.loadEnvironment(modelKey);
      if (this.templates.has(modelKey)) return;
      const parts = collectMeshes(gltf.scene);
      if (parts.length === 0) throw new Error(`Environment asset has no mesh: ${modelKey}`);
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const template = {
        modelKey,
        parts,
        size: box.getSize(new THREE.Vector3()),
        minY: box.min.y,
        maxY: box.max.y,
      };
      this.templates.set(modelKey, template);
    }));
  }

  addInstancedModel(template, transforms, { castShadow, receiveShadow }) {
    if (transforms.length === 0) return;
    for (const part of template.parts) {
      const instances = new THREE.InstancedMesh(part.geometry, part.material, transforms.length);
      const desired = new THREE.Matrix4();
      const final = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      for (let index = 0; index < transforms.length; index += 1) {
        const transform = transforms[index];
        quaternion.setFromAxisAngle(up, transform.rotation);
        position.set(transform.x, transform.y, transform.z);
        scale.set(transform.scaleX, transform.scaleY, transform.scaleZ);
        desired.compose(position, quaternion, scale);
        final.multiplyMatrices(desired, part.matrix);
        instances.setMatrixAt(index, final);
      }
      instances.castShadow = castShadow;
      instances.receiveShadow = receiveShadow;
      this.group.add(instances);
    }
  }

  disposeRoomResources() {
    for (const geometry of this.roomGeometries) geometry.dispose();
    for (const material of this.roomMaterials) material.dispose();
    this.roomGeometries.clear();
    this.roomMaterials.clear();
  }
}
