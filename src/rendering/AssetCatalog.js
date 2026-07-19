import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { getBiome } from "../generation/biomes.js";
import { publicAssetUrl } from "../publicAssetUrl.js";

const CHARACTER_FILES = Object.freeze({
  knight: publicAssetUrl("assets/models/characters/knight.glb"),
  minion: publicAssetUrl("assets/models/characters/skeleton-minion.glb"),
  rogue: publicAssetUrl("assets/models/characters/skeleton-rogue.glb"),
  warrior: publicAssetUrl("assets/models/characters/skeleton-warrior.glb"),
  mage: publicAssetUrl("assets/models/characters/skeleton-mage.glb"),
});

const CRITICAL_CHARACTERS = Object.freeze(["knight", "minion", "rogue", "warrior", "mage"]);

const CRITICAL_ENVIRONMENT = Object.freeze([
  "floor-stone",
  "wall",
  "pillar",
  "pillar-decorated",
  "rubble-large",
  "banner-red",
  "torch-mounted",
]);

export class AssetCatalog {
  constructor() {
    this.gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.textureLoader = new THREE.TextureLoader();
    this.cache = new Map();
    this.progress = { loaded: 0, total: 1, ratio: 0, label: "Preparing the descent" };
    this.listener = null;
  }

  setProgressListener(listener) {
    this.listener = listener;
    listener?.(this.progress);
  }

  async loadCritical() {
    const tasks = [
      ...CRITICAL_CHARACTERS.map((key) => ({ label: key, load: () => this.loadCharacter(key) })),
      ...CRITICAL_ENVIRONMENT.map((key) => ({ label: key, load: () => this.loadEnvironment(key) })),
      { label: "Princess Elowen", load: () => this.loadTexture(publicAssetUrl("assets/vn/characters/elowen-a-human.png")) },
    ];
    this.progress = { loaded: 0, total: tasks.length, ratio: 0, label: "Preparing the descent" };
    this.listener?.(this.progress);
    let loaded = 0;
    await Promise.all(tasks.map(async (task) => {
      await task.load();
      loaded += 1;
      this.progress = {
        loaded,
        total: tasks.length,
        ratio: loaded / tasks.length,
        label: task.label,
      };
      this.listener?.(this.progress);
    }));
  }

  loadCharacter(key) {
    const path = CHARACTER_FILES[key];
    if (!path) throw new RangeError(`Unknown character model: ${key}`);
    return this.loadGltf(path);
  }

  loadEnvironment(key) {
    return this.loadGltf(publicAssetUrl(`assets/models/environment/${key}.glb`));
  }

  async preloadBiome(id) {
    const biome = getBiome(id);
    const keys = new Set([biome.floorModel, biome.wallModel, ...biome.obstacleModels, ...biome.propModels]);
    await Promise.all([...keys].map((key) => this.loadEnvironment(key)));
  }

  loadGltf(path) {
    return this.cached(`gltf:${path}`, () => this.gltfLoader.loadAsync(path));
  }

  loadTexture(path) {
    return this.cached(`texture:${path}`, async () => {
      const texture = await this.textureLoader.loadAsync(path);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      return texture;
    });
  }

  cached(key, loader) {
    if (!this.cache.has(key)) this.cache.set(key, loader());
    return this.cache.get(key);
  }
}
