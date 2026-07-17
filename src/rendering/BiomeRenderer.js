import * as THREE from "three";
import { getBiome } from "../generation/biomes.js";

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

function atlasPlane(index, size) {
  const geometry = new THREE.PlaneGeometry(size, size);
  geometry.rotateX(-Math.PI / 2);
  const uv = geometry.attributes.uv;
  const column = index % 4;
  const row = Math.floor(index / 4);
  for (let vertex = 0; vertex < uv.count; vertex += 1) {
    uv.setXY(vertex, column / 4 + uv.getX(vertex) / 4, (1 - row) / 2 + uv.getY(vertex) / 2);
  }
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
    const biome = getBiome(arena.biome);
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
    await this.addDecals(arena.props ?? [], biome.decalTexture);
    if (token === this.buildToken) this.group.visible = true;
  }

  addFloor(arena, biome) {
    const template = this.template(biome.floorModel);
    const transforms = [];
    const tileWidth = Math.max(1, template.size.x);
    const tileDepth = Math.max(1, template.size.z);
    for (let x = -arena.width / 2 + tileWidth / 2; x < arena.width / 2; x += tileWidth) {
      for (let z = -arena.depth / 2 + tileDepth / 2; z < arena.depth / 2; z += tileDepth) {
        transforms.push({ x, y: -template.minY, z, rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1 });
      }
    }
    this.addInstancedModel(template, transforms, { castShadow: false, receiveShadow: true });
  }

  addWalls(arena, biome) {
    const template = this.template(biome.wallModel);
    const transforms = [];
    const segment = Math.max(2, template.size.x);
    for (let x = -arena.width / 2 + segment / 2; x < arena.width / 2; x += segment) {
      transforms.push({ x, y: -template.minY, z: -arena.depth / 2, rotation: 0, scaleX: 1, scaleY: 1, scaleZ: 1 });
      transforms.push({ x, y: -template.minY, z: arena.depth / 2, rotation: Math.PI, scaleX: 1, scaleY: 1, scaleZ: 1 });
    }
    for (let z = -arena.depth / 2 + segment / 2; z < arena.depth / 2; z += segment) {
      transforms.push({ x: -arena.width / 2, y: -template.minY, z, rotation: Math.PI / 2, scaleX: 1, scaleY: 1, scaleZ: 1 });
      transforms.push({ x: arena.width / 2, y: -template.minY, z, rotation: -Math.PI / 2, scaleX: 1, scaleY: 1, scaleZ: 1 });
    }
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

  async addDecals(props, texturePath) {
    const texture = await this.catalog.loadTexture(texturePath);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.roomMaterials.add(material);
    for (const prop of props.slice(0, 7)) {
      const size = 2.2 + (prop.decalIndex % 3) * 0.55;
      const geometry = atlasPlane(prop.decalIndex, size);
      this.roomGeometries.add(geometry);
      const decal = new THREE.Mesh(geometry, material);
      decal.position.set(prop.x, 0.035, prop.z);
      decal.rotation.y = prop.rotation;
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
