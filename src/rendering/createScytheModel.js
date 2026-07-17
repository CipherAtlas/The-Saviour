import * as THREE from "three";

function createBladeGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0.03, 1.24);
  shape.bezierCurveTo(0.34, 1.42, 0.83, 1.4, 1.12, 1.06);
  shape.bezierCurveTo(1.24, 0.92, 1.3, 0.76, 1.3, 0.61);
  shape.bezierCurveTo(1.16, 0.79, 0.98, 0.91, 0.78, 0.98);
  shape.bezierCurveTo(0.49, 1.08, 0.23, 1.08, 0.08, 1.03);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.065,
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.018,
    bevelThickness: 0.018,
    curveSegments: 18,
  });
  geometry.translate(0, 0, -0.0325);
  return geometry;
}

export function createScytheModel() {
  const group = new THREE.Group();
  group.name = "GraveReaperScythe";
  group.userData.gripPoint = Object.freeze({ x: 0, y: 0, z: 0 });

  const handleMaterial = new THREE.MeshStandardMaterial({ color: 0x241a1e, metalness: 0.12, roughness: 0.66 });
  const bladeMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8d8e3,
    emissive: 0x142636,
    emissiveIntensity: 0.42,
    metalness: 0.9,
    roughness: 0.18,
  });
  const bindingMaterial = new THREE.MeshStandardMaterial({
    color: 0xb98a45,
    emissive: 0x281607,
    emissiveIntensity: 0.3,
    metalness: 0.72,
    roughness: 0.3,
  });

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.058, 1.84, 10), handleMaterial);
  handle.name = "ScytheHandle";
  handle.position.y = 0.35;
  handle.castShadow = true;
  group.add(handle);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.22, 10), bindingMaterial);
  collar.position.y = 1.23;
  collar.castShadow = true;
  group.add(collar);

  const gripWrap = new THREE.Group();
  gripWrap.name = "ScytheGripWrap";
  for (let index = -2; index <= 2; index += 1) {
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.009, 5, 12), bindingMaterial);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.y = index * 0.052;
    gripWrap.add(wrap);
  }
  group.add(gripWrap);

  const blade = new THREE.Mesh(createBladeGeometry(), bladeMaterial);
  blade.name = "ScytheBlade";
  blade.castShadow = true;
  group.add(blade);

  const bladeHeel = new THREE.Object3D();
  bladeHeel.name = "ScytheBladeHeel";
  bladeHeel.position.set(0.08, 1.04, 0);
  const bladeTip = new THREE.Object3D();
  bladeTip.name = "ScytheBladeTip";
  bladeTip.position.set(1.29, 0.65, 0);
  group.add(bladeHeel, bladeTip);

  const counterweight = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), bindingMaterial);
  counterweight.name = "ScytheCounterweight";
  counterweight.position.y = -0.59;
  counterweight.rotation.y = Math.PI / 4;
  group.add(counterweight);
  return group;
}
