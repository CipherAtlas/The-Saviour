import * as THREE from "three";
import { CAMERA_CONFIG } from "../game/gameConfig.js";

export class GameCamera {
  constructor(settings) {
    this.settings = settings;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
    this.focus = new THREE.Vector3(0, 0, 0);
    this.trauma = 0;
    this.time = 0;
    this.aspect = 1;
    this.arena = null;
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.intersection = new THREE.Vector3();
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width, height) {
    this.aspect = width / Math.max(1, height);
    this.updateProjection(1);
  }

  updateProjection(dynamicMultiplier) {
    const zoom = this.settings.get("camera.zoom");
    const viewHeight = (CAMERA_CONFIG.baseViewHeight * dynamicMultiplier) / zoom;
    const viewWidth = viewHeight * this.aspect;
    this.camera.left = -viewWidth / 2;
    this.camera.right = viewWidth / 2;
    this.camera.top = viewHeight / 2;
    this.camera.bottom = -viewHeight / 2;
    this.camera.updateProjectionMatrix();
  }

  setArena(arena) {
    this.arena = arena;
  }

  snapTo(position) {
    this.focus.set(position.x, 0, position.z);
    this.positionCamera(this.focus, 0, 0);
  }

  addTrauma(amount) {
    if (this.settings.get("camera.reducedMotion")) return;
    this.trauma = Math.min(1, this.trauma + amount * this.settings.get("camera.shake"));
  }

  update(dt, playerPosition, aimPoint, bossActive, portalTraversal = null, endingUrgency = 0) {
    this.time += dt;
    const lookAheadSetting = this.settings.get("camera.aimLookAhead");
    const dx = aimPoint.x - playerPosition.x;
    const dz = aimPoint.z - playerPosition.z;
    const length = Math.hypot(dx, dz) || 1;
    const lookAhead = CAMERA_CONFIG.aimLookAhead * lookAheadSetting;
    const targetX = portalTraversal?.target?.x ?? playerPosition.x + (dx / length) * lookAhead;
    const targetZ = portalTraversal?.target?.z ?? playerPosition.z + (dz / length) * lookAhead + 0.9;
    const target = new THREE.Vector3(targetX, 0, targetZ);

    if (this.arena) {
      target.x = THREE.MathUtils.clamp(target.x, -this.arena.width / 2 + 5, this.arena.width / 2 - 5);
      target.z = THREE.MathUtils.clamp(target.z, -this.arena.depth / 2 + 4, this.arena.depth / 2 - 4);
    }

    const followRate = portalTraversal ? CAMERA_CONFIG.followRate * 1.75 : CAMERA_CONFIG.followRate;
    const smoothing = 1 - Math.exp(-followRate * dt);
    this.focus.lerp(target, smoothing);
    this.trauma = Math.max(0, this.trauma - dt * 2.4);
    const endingShake = this.settings.get("camera.reducedMotion")
      ? 0
      : Math.max(0, Math.min(1, endingUrgency)) * this.settings.get("camera.shake");
    const shake = Math.max(this.trauma * this.trauma, endingShake * endingShake * 0.92);
    const frequency = 1 + endingShake * 0.72;
    const shakeX = Math.sin(this.time * 43.7 * frequency) * shake * 0.32;
    const shakeZ = Math.sin(this.time * 37.1 * frequency + 1.7) * shake * 0.25;
    let dynamicMultiplier = this.settings.get("camera.dynamicZoom") && bossActive ? CAMERA_CONFIG.bossZoomMultiplier : 1;
    if (portalTraversal && !this.settings.get("camera.reducedMotion")) {
      dynamicMultiplier *= 1 - Math.sin(portalTraversal.progress * Math.PI) * 0.065;
    }
    this.updateProjection(dynamicMultiplier);
    this.positionCamera(this.focus, shakeX, shakeZ);
  }

  positionCamera(focus, shakeX, shakeZ) {
    const distance = 28;
    const horizontal = Math.cos(CAMERA_CONFIG.pitch) * distance;
    const offsetX = Math.cos(CAMERA_CONFIG.yaw) * horizontal;
    const offsetZ = Math.sin(CAMERA_CONFIG.yaw) * horizontal;
    const offsetY = Math.sin(CAMERA_CONFIG.pitch) * distance;
    this.camera.position.set(focus.x + offsetX + shakeX, offsetY, focus.z + offsetZ + shakeZ);
    this.camera.lookAt(focus.x + shakeX, 0, focus.z + shakeZ);
  }

  screenToGround(pointerNdc) {
    this.raycaster.setFromCamera(pointerNdc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersection);
    return hit ? { x: hit.x, z: hit.z } : { x: this.focus.x, z: this.focus.z };
  }
}
