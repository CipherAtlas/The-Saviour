import * as THREE from "three";

const geometry = Object.freeze({
  grip: new THREE.CylinderGeometry(0.045, 0.052, 0.34, 8),
  blade: new THREE.BoxGeometry(0.13, 0.74, 0.045),
  dagger: new THREE.BoxGeometry(0.11, 0.52, 0.035),
  guard: new THREE.BoxGeometry(0.34, 0.06, 0.08),
  staff: new THREE.CylinderGeometry(0.045, 0.06, 1.48, 9),
  orb: new THREE.IcosahedronGeometry(0.18, 1),
  bomb: new THREE.IcosahedronGeometry(0.24, 1),
  fuse: new THREE.TorusGeometry(0.11, 0.025, 6, 12, Math.PI * 1.15),
  shield: new THREE.CylinderGeometry(0.43, 0.43, 0.12, 8),
  shieldBoss: new THREE.TorusGeometry(0.33, 0.065, 7, 18),
  axeHead: new THREE.ConeGeometry(0.27, 0.5, 3),
  crownBand: new THREE.TorusGeometry(0.28, 0.045, 7, 22),
  crownSpike: new THREE.ConeGeometry(0.07, 0.34, 5),
  pauldron: new THREE.ConeGeometry(0.23, 0.38, 5),
});

const material = Object.freeze({
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x292a31, metalness: 0.86, roughness: 0.3 }),
  edge: new THREE.MeshStandardMaterial({ color: 0x9ca8b4, metalness: 0.92, roughness: 0.2 }),
  boneGold: new THREE.MeshStandardMaterial({ color: 0xb79455, metalness: 0.72, roughness: 0.34 }),
  violet: new THREE.MeshStandardMaterial({ color: 0x9c61d8, emissive: 0x481466, emissiveIntensity: 1.35, metalness: 0.28, roughness: 0.24 }),
  spectral: new THREE.MeshStandardMaterial({ color: 0xbca8ff, emissive: 0x6633cc, emissiveIntensity: 2.2, metalness: 0.1, roughness: 0.18, transparent: true, opacity: 0.84 }),
  cinder: new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0x9b1c05, emissiveIntensity: 2.6, metalness: 0.12, roughness: 0.28 }),
  queen: new THREE.MeshStandardMaterial({ color: 0xe0a6f2, emissive: 0x67127e, emissiveIntensity: 1.5, metalness: 0.66, roughness: 0.24 }),
});

function mesh(sourceGeometry, sourceMaterial, name) {
  const result = new THREE.Mesh(sourceGeometry, sourceMaterial);
  result.name = name;
  result.castShadow = false;
  return result;
}

function bladeWeapon({ short = false, spectral = false, axe = false } = {}) {
  const group = new THREE.Group();
  group.name = axe ? "EnemyAxe" : spectral ? "WraithBlade" : short ? "EnemyDagger" : "EnemySword";
  const grip = mesh(geometry.grip, material.darkMetal, "WeaponGrip");
  grip.position.y = 0.08;
  const guard = mesh(geometry.guard, axe ? material.boneGold : material.darkMetal, "WeaponGuard");
  guard.position.y = 0.25;
  const blade = mesh(
    axe ? geometry.axeHead : short ? geometry.dagger : geometry.blade,
    spectral ? material.spectral : material.edge,
    "WeaponBlade",
  );
  if (axe) {
    blade.rotation.z = Math.PI / 2;
    blade.position.set(0.17, 0.84, 0);
    const haft = mesh(geometry.staff, material.darkMetal, "AxeHaft");
    haft.scale.y = 0.68;
    haft.position.y = 0.5;
    group.add(haft);
  } else {
    blade.position.y = short ? 0.53 : 0.68;
  }
  group.add(grip, guard, blade);
  return group;
}

function staffWeapon(queen = false) {
  const group = new THREE.Group();
  group.name = queen ? "QueenScepter" : "HexStaff";
  const shaft = mesh(geometry.staff, queen ? material.boneGold : material.darkMetal, "StaffShaft");
  shaft.position.y = 0.62;
  const orb = mesh(queen ? geometry.shieldBoss : geometry.orb, queen ? material.queen : material.violet, "StaffFocus");
  orb.position.y = 1.38;
  if (queen) orb.rotation.x = Math.PI / 2;
  group.add(shaft, orb);
  return group;
}

function shield() {
  const group = new THREE.Group();
  group.name = "BoneguardShield";
  const plate = mesh(geometry.shield, material.boneGold, "ShieldPlate");
  plate.rotation.x = Math.PI / 2;
  plate.position.y = 0.3;
  const boss = mesh(geometry.shieldBoss, material.darkMetal, "ShieldBoss");
  boss.position.set(0, 0.3, 0.075);
  group.add(plate, boss);
  return group;
}

function bomb() {
  const group = new THREE.Group();
  group.name = "CinderBomb";
  const body = mesh(geometry.bomb, material.cinder, "BombBody");
  body.position.y = 0.28;
  const fuse = mesh(geometry.fuse, material.edge, "BombFuse");
  fuse.position.set(0, 0.49, 0);
  fuse.rotation.z = Math.PI / 2;
  group.add(body, fuse);
  return group;
}

function queenCrown() {
  const group = new THREE.Group();
  group.name = "HollowQueenCrown";
  const band = mesh(geometry.crownBand, material.queen, "CrownBand");
  band.rotation.x = Math.PI / 2;
  group.add(band);
  for (let index = 0; index < 5; index += 1) {
    const angle = (index / 5) * Math.PI * 2;
    const spike = mesh(geometry.crownSpike, material.queen, "CrownSpike");
    spike.position.set(Math.cos(angle) * 0.22, 0.22, Math.sin(angle) * 0.22);
    group.add(spike);
  }
  group.position.y = 0.42;
  return group;
}

function queenShoulders() {
  const group = new THREE.Group();
  group.name = "HollowQueenPauldrons";
  for (const side of [-1, 1]) {
    const pauldron = mesh(geometry.pauldron, material.queen, "QueenPauldron");
    pauldron.position.set(side * 0.42, 0.26, 0);
    pauldron.rotation.z = side * -Math.PI / 2;
    group.add(pauldron);
  }
  return group;
}

function attach(model, slotName, object, rotationY = Math.PI) {
  const slot = model.getObjectByName(slotName);
  if (!slot) return false;
  object.rotation.y = rotationY;
  slot.add(object);
  return true;
}

export function createEnemyEquipment(model, equipment) {
  const attached = [];
  const add = (slot, object, rotationY) => {
    if (!attach(model, slot, object, rotationY)) return;
    attached.push(object);
  };

  if (equipment === "rustSword") add("handslot.r", bladeWeapon());
  if (equipment === "twinBlades") {
    add("handslot.r", bladeWeapon({ short: true }));
    add("handslot.l", bladeWeapon({ short: true }), 0);
  }
  if (equipment === "shieldAxe") {
    add("handslot.r", bladeWeapon({ axe: true }));
    add("handslot.l", shield(), 0);
  }
  if (equipment === "hexStaff") add("handslot.r", staffWeapon());
  if (equipment === "wraithBlades") {
    add("handslot.r", bladeWeapon({ short: true, spectral: true }));
    add("handslot.l", bladeWeapon({ short: true, spectral: true }), 0);
  }
  if (equipment === "cinderBomb") {
    add("handslot.r", bomb());
    const pack = bomb();
    pack.scale.setScalar(1.25);
    pack.rotation.x = Math.PI / 2;
    pack.position.set(0, 0.02, -0.32);
    add("chest", pack, 0);
  }
  if (equipment === "queenRegalia") {
    add("handslot.r", staffWeapon(true));
    add("head", queenCrown(), 0);
    add("chest", queenShoulders(), 0);
  }
  return attached;
}
