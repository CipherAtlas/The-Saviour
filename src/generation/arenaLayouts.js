import { createWalkableShape } from "../game/arenaGeometry.js";
import { SeededRandom } from "./seededRandom.js";

const MIN_CONNECTOR_WIDTH = 8;

const point = (x, z) => ({ x, z });
const zone = (id, x, z, radius, regionId) => ({ id, x, z, radius, regionId });
const region = (id, role, x, z, width, depth) => ({ id, role, x, z, width, depth });
const connector = (id, from, to, width) => ({ id, from, to, width: Math.max(MIN_CONNECTOR_WIDTH, width) });
const slot = (x, z, width = 2.8, depth = 2.8, height = 2.5) => ({ x, z, width, depth, height });

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function jitteredSlot(rng, x, z, width = 2.8, depth = 2.8, height = 2.5) {
  return slot(
    x + rng.float(-0.55, 0.55),
    z + rng.float(-0.55, 0.55),
    width * rng.float(0.9, 1.12),
    depth * rng.float(0.9, 1.12),
    height,
  );
}

function roomComplexity(room) {
  return clamp(Math.round(room), 1, 3);
}

function progressionRanges(floor) {
  if (floor <= 3) return { width: [40, 48], depth: [30, 38] };
  if (floor <= 6) return { width: [46, 56], depth: [34, 44] };
  return { width: [54, 66], depth: [40, 50] };
}

function progressiveDimension(range, complexity, rng) {
  const span = range[1] - range[0];
  const lowerRatios = [0, 0.2, 0.5];
  const upperRatios = [0.5, 0.8, 1];
  const minimum = Math.ceil(range[0] + span * lowerRatios[complexity - 1]);
  const maximum = Math.floor(range[0] + span * upperRatios[complexity - 1]);
  return rng.int(minimum, maximum);
}

function freezeDefinition(definition) {
  return Object.freeze(definition);
}

function openCourtyard({ width, depth, complexity, rng }) {
  const courtDepth = Math.max(20, depth * rng.float(0.62, 0.68));
  const galleryWidth = Math.max(28, width * rng.float(0.68, 0.74));
  const regions = [
    region("court", "combat", 0, 0, width, courtDepth),
    region("gallery", "route", 0, 0, galleryWidth, depth),
  ];
  const side = rng.chance(0.5) ? -1 : 1;
  const combatZones = [
    zone("court-west", -width * 0.24, 0, 5.4, "court"),
    zone("court-east", width * 0.24, 0, 5.4, "court"),
    ...(complexity >= 2 ? [zone("court-gallery", 0, side * depth * 0.28, 4.8, "gallery")] : []),
  ];
  return {
    regions,
    majorRegionIds: ["court"],
    connectors: [connector("court-gallery-crossing", "court", "gallery", Math.min(courtDepth, galleryWidth))],
    playerSpawn: point(0, -depth / 2 + 3.8),
    portal: point(rng.float(-1.1, 1.1), rng.float(-0.7, 0.7)),
    rewardPosition: point(side * width * 0.24, depth * 0.24),
    combatZones,
    obstacleSlots: [
      jitteredSlot(rng, -width * 0.34, -courtDepth * 0.28),
      jitteredSlot(rng, width * 0.34, -courtDepth * 0.28),
      jitteredSlot(rng, -width * 0.34, courtDepth * 0.28),
      jitteredSlot(rng, width * 0.34, courtDepth * 0.28),
      ...(complexity >= 2 ? [
        jitteredSlot(rng, -galleryWidth * 0.32, side * depth * 0.36, 3.1, 2.6),
        jitteredSlot(rng, galleryWidth * 0.32, side * depth * 0.36, 3.1, 2.6),
      ] : []),
    ],
  };
}

function longHall({ width, depth, complexity, rng }) {
  const hallDepth = Math.max(17, depth * rng.float(0.54, 0.6));
  const bayWidth = Math.max(12, width * rng.float(0.22, 0.27));
  const bayOffset = width * rng.float(0.2, 0.28);
  const bayDepth = (depth - hallDepth) / 2 + 2;
  const bayCenterZ = depth / 2 - bayDepth / 2;
  const regions = [
    region("hall", "combat", 0, 0, width, hallDepth),
    region("north-bay", "combat", -bayOffset, bayCenterZ, bayWidth, bayDepth),
    region("south-bay", "combat", bayOffset, -bayCenterZ, bayWidth, bayDepth),
  ];
  const combatZones = [
    zone("hall-west", -width * 0.3, 0, 4.8, "hall"),
    zone("hall-center", 0, 0, 4.8, "hall"),
    zone("hall-east", width * 0.3, 0, 4.8, "hall"),
  ];
  return {
    regions,
    majorRegionIds: ["hall"],
    connectors: [
      connector("hall-north-bay", "hall", "north-bay", bayWidth),
      connector("hall-south-bay", "hall", "south-bay", bayWidth),
    ],
    playerSpawn: point(-width / 2 + 4, 0),
    portal: point(rng.float(-1.1, 1.1), rng.float(-0.8, 0.8)),
    rewardPosition: point(width / 2 - 5, rng.float(-1, 1)),
    combatZones,
    obstacleSlots: [
      jitteredSlot(rng, -width * 0.36, -hallDepth * 0.25, 3.2, 2.5),
      jitteredSlot(rng, -width * 0.18, hallDepth * 0.25, 2.6, 3.1),
      jitteredSlot(rng, width * 0.04, -hallDepth * 0.27, 3.3, 2.5),
      jitteredSlot(rng, width * 0.23, hallDepth * 0.25, 2.7, 3.2),
      jitteredSlot(rng, width * 0.39, -hallDepth * 0.24, 3.1, 2.5),
      ...(complexity >= 3 ? [jitteredSlot(rng, bayOffset, -depth * 0.38, 2.6, 2.6)] : []),
    ],
  };
}

function lShape({ width, depth, complexity, rng }) {
  const verticalWidth = Math.max(16, width * rng.float(0.37, 0.43));
  const horizontalDepth = Math.max(14, depth * rng.float(0.39, 0.45));
  const verticalSide = rng.chance(0.5) ? -1 : 1;
  const horizontalSide = rng.chance(0.5) ? -1 : 1;
  const verticalX = verticalSide * (width - verticalWidth) / 2;
  const horizontalZ = horizontalSide * (depth - horizontalDepth) / 2;
  const regions = [
    region("vertical-lobe", "combat", verticalX, 0, verticalWidth, depth),
    region("horizontal-lobe", "combat", 0, horizontalZ, width, horizontalDepth),
  ];
  const farHorizontalX = -verticalSide * (width / 2 - 4.2);
  const farVerticalZ = -horizontalSide * (depth / 2 - 3.8);
  return {
    regions,
    majorRegionIds: ["vertical-lobe", "horizontal-lobe"],
    connectors: [connector("elbow", "vertical-lobe", "horizontal-lobe", Math.min(verticalWidth, horizontalDepth))],
    playerSpawn: point(verticalX, farVerticalZ),
    portal: point(verticalX - verticalSide * verticalWidth * 0.18, horizontalZ - horizontalSide * horizontalDepth * 0.16),
    rewardPosition: point(farHorizontalX, horizontalZ),
    combatZones: [
      zone("vertical-fight", verticalX, -horizontalSide * depth * 0.24, 5.2, "vertical-lobe"),
      zone("elbow-fight", verticalX, horizontalZ, 4.8, "vertical-lobe"),
      zone("horizontal-fight", -verticalSide * width * 0.27, horizontalZ, 5.2, "horizontal-lobe"),
    ],
    obstacleSlots: [
      jitteredSlot(rng, verticalX - verticalWidth * 0.22, -horizontalSide * depth * 0.31),
      jitteredSlot(rng, verticalX + verticalWidth * 0.22, -horizontalSide * depth * 0.12, 2.6, 3.1),
      jitteredSlot(rng, -verticalSide * width * 0.18, horizontalZ - horizontalDepth * 0.22, 3.2, 2.5),
      jitteredSlot(rng, -verticalSide * width * 0.36, horizontalZ + horizontalDepth * 0.22, 2.6, 3.1),
      jitteredSlot(rng, verticalX - verticalSide * verticalWidth * 0.23, 0, 2.6, 3),
      jitteredSlot(rng, -verticalSide * width * 0.06, horizontalZ + horizontalSide * horizontalDepth * 0.27, 3, 2.6),
      ...(complexity >= 2 ? [jitteredSlot(rng, verticalX + verticalSide * verticalWidth * 0.17, horizontalSide * depth * 0.3)] : []),
    ],
  };
}

function tShape({ width, depth, complexity, rng }) {
  const capDepth = Math.max(14, depth * rng.float(0.38, 0.44));
  const stemWidth = Math.max(16, width * rng.float(0.35, 0.42));
  const capSide = rng.chance(0.5) ? -1 : 1;
  const stemOffset = complexity >= 3 ? rng.float(-width * 0.07, width * 0.07) : 0;
  const capZ = capSide * (depth - capDepth) / 2;
  const regions = [
    region("cap", "combat", 0, capZ, width, capDepth),
    region("stem", "combat", stemOffset, 0, stemWidth, depth),
  ];
  const rewardSide = rng.chance(0.5) ? -1 : 1;
  return {
    regions,
    majorRegionIds: ["cap", "stem"],
    connectors: [connector("junction", "cap", "stem", stemWidth)],
    playerSpawn: point(stemOffset, -capSide * (depth / 2 - 3.8)),
    portal: point(stemOffset, capZ - capSide * capDepth * 0.18),
    rewardPosition: point(rewardSide * (width / 2 - 4.4), capZ),
    combatZones: [
      zone("stem-fight", stemOffset, -capSide * depth * 0.24, 5.1, "stem"),
      zone("cap-left", -width * 0.26, capZ, 5, "cap"),
      zone("cap-right", width * 0.26, capZ, 5, "cap"),
    ],
    obstacleSlots: [
      jitteredSlot(rng, stemOffset - stemWidth * 0.25, -capSide * depth * 0.3),
      jitteredSlot(rng, stemOffset + stemWidth * 0.25, -capSide * depth * 0.13, 2.6, 3.2),
      jitteredSlot(rng, -width * 0.36, capZ - capDepth * 0.22, 3.1, 2.6),
      jitteredSlot(rng, -width * 0.18, capZ + capDepth * 0.23, 2.7, 3.1),
      jitteredSlot(rng, width * 0.19, capZ - capDepth * 0.23, 2.7, 3.1),
      jitteredSlot(rng, width * 0.37, capZ + capDepth * 0.22, 3.1, 2.6),
    ],
  };
}

function cruciform({ width, depth, complexity, rng }) {
  const horizontalDepth = Math.max(12, depth * rng.float(0.32, 0.38));
  const verticalWidth = Math.max(12, width * rng.float(0.28, 0.34));
  const offsetX = complexity >= 3 ? rng.float(-1.2, 1.2) : 0;
  const offsetZ = complexity >= 2 ? rng.float(-1, 1) : 0;
  const regions = [
    region("horizontal-arm", "combat", 0, offsetZ, width, horizontalDepth),
    region("vertical-arm", "combat", offsetX, 0, verticalWidth, depth),
  ];
  const rewardArm = rng.chance(0.5) ? -1 : 1;
  return {
    regions,
    majorRegionIds: ["horizontal-arm", "vertical-arm"],
    connectors: [connector("crossing", "horizontal-arm", "vertical-arm", Math.min(horizontalDepth, verticalWidth))],
    playerSpawn: point(offsetX, -depth / 2 + 3.8),
    portal: point(offsetX, offsetZ),
    rewardPosition: point(rewardArm * (width / 2 - 4.2), offsetZ),
    combatZones: [
      zone("crossing-fight", offsetX, offsetZ, 4.6, "horizontal-arm"),
      zone("west-arm", -width * 0.31, offsetZ, 4.7, "horizontal-arm"),
      zone("east-arm", width * 0.31, offsetZ, 4.7, "horizontal-arm"),
      ...(complexity >= 2 ? [zone("north-arm", offsetX, depth * 0.3, 4.7, "vertical-arm")] : []),
    ],
    obstacleSlots: [
      jitteredSlot(rng, -width * 0.35, offsetZ - horizontalDepth * 0.24, 3.1, 2.4),
      jitteredSlot(rng, -width * 0.18, offsetZ + horizontalDepth * 0.24, 2.6, 3),
      jitteredSlot(rng, width * 0.18, offsetZ - horizontalDepth * 0.24, 2.6, 3),
      jitteredSlot(rng, width * 0.35, offsetZ + horizontalDepth * 0.24, 3.1, 2.4),
      jitteredSlot(rng, offsetX - verticalWidth * 0.24, depth * 0.32, 2.5, 3.1),
      jitteredSlot(rng, offsetX + verticalWidth * 0.24, -depth * 0.29, 2.5, 3.1),
    ],
  };
}

function hourglass({ width, depth, complexity, rng }) {
  const horizontalOffset = complexity >= 2 ? rng.float(0.8, 2) : 0;
  const lobeWidth = width - horizontalOffset * 2;
  const waistWidth = rng.float(8.4, Math.min(12, lobeWidth * 0.42));
  const waistGap = rng.float(6.5, Math.min(10, depth * 0.25));
  const overlap = 1.8;
  const lobeDepth = Math.max(12, (depth - waistGap) / 2 + overlap);
  const lobeOffsetZ = depth / 2 - lobeDepth / 2;
  const waistDepth = Math.max(MIN_CONNECTOR_WIDTH, depth - lobeDepth * 2 + overlap * 2);
  const regions = [
    region("south-lobe", "combat", -horizontalOffset, -lobeOffsetZ, lobeWidth, lobeDepth),
    region("waist", "route", 0, 0, waistWidth, waistDepth),
    region("north-lobe", "combat", horizontalOffset, lobeOffsetZ, lobeWidth, lobeDepth),
  ];
  return {
    regions,
    majorRegionIds: ["south-lobe", "north-lobe"],
    connectors: [
      connector("south-waist", "south-lobe", "waist", waistWidth),
      connector("north-waist", "waist", "north-lobe", waistWidth),
    ],
    playerSpawn: point(-horizontalOffset, -depth / 2 + 3.8),
    portal: point(rng.float(-0.6, 0.6), rng.float(-0.5, 0.5)),
    rewardPosition: point(horizontalOffset, depth / 2 - 4.2),
    combatZones: [
      zone("south-fight", -horizontalOffset, -lobeOffsetZ, 5.5, "south-lobe"),
      zone("north-fight", horizontalOffset, lobeOffsetZ, 5.5, "north-lobe"),
    ],
    obstacleSlots: [
      jitteredSlot(rng, -lobeWidth * 0.28 - horizontalOffset, -lobeOffsetZ - lobeDepth * 0.18),
      jitteredSlot(rng, lobeWidth * 0.28 - horizontalOffset, -lobeOffsetZ + lobeDepth * 0.18),
      jitteredSlot(rng, -lobeWidth * 0.28 + horizontalOffset, lobeOffsetZ - lobeDepth * 0.18),
      jitteredSlot(rng, lobeWidth * 0.28 + horizontalOffset, lobeOffsetZ + lobeDepth * 0.18),
      ...(complexity >= 3 ? [
        jitteredSlot(rng, -lobeWidth * 0.13 - horizontalOffset, -lobeOffsetZ + lobeDepth * 0.26, 2.5, 2.5),
        jitteredSlot(rng, lobeWidth * 0.13 + horizontalOffset, lobeOffsetZ - lobeDepth * 0.26, 2.5, 2.5),
      ] : []),
    ],
  };
}

function offsetTwinChambers({ width, depth, complexity, rng }) {
  const chamberWidth = Math.max(17, width * rng.float(0.4, 0.45));
  const chamberDepth = Math.max(19, depth * rng.float(0.6, 0.68));
  const passageDepth = rng.float(8.5, Math.min(12, chamberDepth * 0.5));
  const offsetZ = (depth - chamberDepth) / 2;
  const slope = rng.chance(0.5) ? -1 : 1;
  const leftX = -(width - chamberWidth) / 2;
  const rightX = (width - chamberWidth) / 2;
  const passageWidth = Math.max(8, width - chamberWidth * 2 + 4);
  const regions = [
    region("left-chamber", "combat", leftX, slope * offsetZ, chamberWidth, chamberDepth),
    region("passage", "route", 0, 0, passageWidth, passageDepth),
    region("right-chamber", "combat", rightX, -slope * offsetZ, chamberWidth, chamberDepth),
  ];
  const playerZ = slope * offsetZ;
  const rewardZ = -slope * offsetZ;
  return {
    regions,
    majorRegionIds: ["left-chamber", "right-chamber"],
    connectors: [
      connector("left-passage", "left-chamber", "passage", passageDepth),
      connector("right-passage", "passage", "right-chamber", passageDepth),
    ],
    playerSpawn: point(-width / 2 + 3.8, playerZ),
    portal: point(rng.float(-0.7, 0.7), rng.float(-0.55, 0.55)),
    rewardPosition: point(width / 2 - 4.2, rewardZ),
    combatZones: [
      zone("left-fight", leftX, playerZ, 5.5, "left-chamber"),
      zone("right-fight", rightX, rewardZ, 5.5, "right-chamber"),
    ],
    obstacleSlots: [
      jitteredSlot(rng, leftX - chamberWidth * 0.25, playerZ - chamberDepth * 0.2),
      jitteredSlot(rng, leftX + chamberWidth * 0.25, playerZ + chamberDepth * 0.2),
      jitteredSlot(rng, rightX - chamberWidth * 0.25, rewardZ - chamberDepth * 0.2),
      jitteredSlot(rng, rightX + chamberWidth * 0.25, rewardZ + chamberDepth * 0.2),
      ...(complexity >= 2 ? [
        jitteredSlot(rng, leftX, playerZ + chamberDepth * 0.31, 3, 2.5),
        jitteredSlot(rng, rightX, rewardZ - chamberDepth * 0.31, 3, 2.5),
      ] : []),
    ],
  };
}

function brokenRing({ width, depth, complexity, rng }) {
  const horizontalThickness = Math.max(12, depth * rng.float(0.22, 0.27));
  const verticalThickness = Math.max(8, width * rng.float(0.15, 0.19));
  const insideDepth = Math.max(8, depth - horizontalThickness * 2 + 2);
  const bridgeWidth = rng.float(12, Math.max(12, Math.min(14, width * 0.27)));
  const bridgeX = (complexity >= 2 ? rng.float(0.04, 0.12) : 0) * width * (rng.chance(0.5) ? -1 : 1);
  const topZ = (depth - horizontalThickness) / 2;
  const sideDepth = depth - horizontalThickness * 2 + 2;
  const sideX = (width - verticalThickness) / 2;
  const regions = [
    region("south-arc", "combat", 0, -topZ, width, horizontalThickness),
    region("north-arc", "combat", 0, topZ, width, horizontalThickness),
    region("west-arc", "route", -sideX, 0, verticalThickness, sideDepth),
    region("east-arc", "route", sideX, 0, verticalThickness, sideDepth),
    region("broad-bridge", "combat", bridgeX, 0, bridgeWidth, insideDepth),
  ];
  const rewardSide = rng.chance(0.5) ? -1 : 1;
  return {
    regions,
    majorRegionIds: ["south-arc", "north-arc", "broad-bridge"],
    connectors: [
      connector("west-south-turn", "south-arc", "west-arc", verticalThickness),
      connector("west-north-turn", "west-arc", "north-arc", verticalThickness),
      connector("east-south-turn", "south-arc", "east-arc", verticalThickness),
      connector("east-north-turn", "east-arc", "north-arc", verticalThickness),
      connector("south-bridge", "south-arc", "broad-bridge", bridgeWidth),
      connector("north-bridge", "broad-bridge", "north-arc", bridgeWidth),
    ],
    playerSpawn: point(-width * 0.28, -depth / 2 + 3.7),
    portal: point(bridgeX, rng.float(-0.8, 0.8)),
    rewardPosition: point(rewardSide * width * 0.3, depth / 2 - 4),
    combatZones: [
      zone("south-ring-fight", -width * 0.2, -topZ, 5.2, "south-arc"),
      zone("north-ring-fight", width * 0.2, topZ, 5.2, "north-arc"),
      zone("bridge-fight", bridgeX, 0, 4.5, "broad-bridge"),
    ],
    obstacleSlots: [
      jitteredSlot(rng, -width * 0.36, -topZ, 2.7, 3),
      jitteredSlot(rng, width * 0.14, -topZ, 3.1, 2.5),
      jitteredSlot(rng, width * 0.37, -topZ, 2.7, 3),
      jitteredSlot(rng, -width * 0.36, topZ, 2.7, 3),
      jitteredSlot(rng, -width * 0.14, topZ, 3.1, 2.5),
      jitteredSlot(rng, width * 0.36, topZ, 2.7, 3),
    ],
  };
}

function bossCourt({ width, depth, rng }) {
  const regions = [region("boss-court", "combat", 0, 0, width, depth)];
  return {
    regions,
    majorRegionIds: ["boss-court"],
    connectors: [],
    playerSpawn: point(0, -depth / 2 + 4.2),
    portal: point(0, 0),
    rewardPosition: point(0, depth / 2 - 6),
    combatZones: [zone("boss-center", 0, 1, 9.5, "boss-court")],
    obstacleSlots: [
      jitteredSlot(rng, -width * 0.38, -depth * 0.23, 3.2, 3.2, 3.2),
      jitteredSlot(rng, width * 0.38, -depth * 0.23, 3.2, 3.2, 3.2),
      jitteredSlot(rng, -width * 0.38, depth * 0.27, 3.2, 3.2, 3.2),
      jitteredSlot(rng, width * 0.38, depth * 0.27, 3.2, 3.2, 3.2),
    ],
  };
}

export const NORMAL_ARENA_LAYOUT_IDS = Object.freeze([
  "openCourtyard",
  "longHall",
  "lShape",
  "tShape",
  "cruciform",
  "hourglass",
  "offsetTwinChambers",
  "brokenRing",
]);

export const ARENA_LAYOUTS = Object.freeze({
  openCourtyard: freezeDefinition({ id: "openCourtyard", build: openCourtyard }),
  longHall: freezeDefinition({ id: "longHall", build: longHall }),
  lShape: freezeDefinition({ id: "lShape", build: lShape }),
  tShape: freezeDefinition({ id: "tShape", build: tShape }),
  cruciform: freezeDefinition({ id: "cruciform", build: cruciform }),
  hourglass: freezeDefinition({ id: "hourglass", build: hourglass }),
  offsetTwinChambers: freezeDefinition({ id: "offsetTwinChambers", build: offsetTwinChambers }),
  brokenRing: freezeDefinition({ id: "brokenRing", build: brokenRing }),
  bossCourt: freezeDefinition({ id: "bossCourt", build: bossCourt }),
});

function layoutCycle(seed, cycleIndex, previousFamily) {
  const rng = new SeededRandom(`${seed}:arena-layout-cycle:${cycleIndex}`);
  const cycle = rng.shuffle(NORMAL_ARENA_LAYOUT_IDS);
  if (previousFamily && cycle[0] === previousFamily) {
    const replacementIndex = cycle.findIndex((id) => id !== previousFamily);
    [cycle[0], cycle[replacementIndex]] = [cycle[replacementIndex], cycle[0]];
  }
  return cycle;
}

export function chooseArenaLayout({ seed, floor, room, boss, rng }) {
  if (boss) return ARENA_LAYOUTS.bossCourt;
  const routeIndex = (Math.max(1, floor) - 1) * 3 + (Math.max(1, room) - 1);
  const runSeed = String(seed ?? rng?.seed ?? "arena-layout");
  const targetCycle = Math.floor(routeIndex / NORMAL_ARENA_LAYOUT_IDS.length);
  let previousFamily = null;
  let selectedCycle = null;
  for (let cycleIndex = 0; cycleIndex <= targetCycle; cycleIndex += 1) {
    selectedCycle = layoutCycle(runSeed, cycleIndex, previousFamily);
    previousFamily = selectedCycle.at(-1);
  }
  const family = selectedCycle[routeIndex % NORMAL_ARENA_LAYOUT_IDS.length];
  return ARENA_LAYOUTS[family];
}

export function instantiateArenaLayout(definition, rng, { floor = 1, room = 1, boss = false } = {}) {
  const complexity = boss ? 3 : roomComplexity(room);
  const ranges = boss ? { width: [56, 60], depth: [42, 46] } : progressionRanges(floor);
  const width = progressiveDimension(ranges.width, complexity, rng.fork("width"));
  const depth = progressiveDimension(ranges.depth, complexity, rng.fork("depth"));
  const built = definition.build({ width, depth, complexity, rng: rng.fork("authored-variation") });
  const walkableShape = createWalkableShape({
    regions: built.regions,
    majorRegionIds: built.majorRegionIds,
    connectors: built.connectors,
  });
  return {
    layoutFamily: definition.id,
    layoutComplexity: complexity,
    width,
    depth,
    walkableShape,
    obstacleSlots: built.obstacleSlots,
    combatZones: built.combatZones,
    playerSpawn: built.playerSpawn,
    portal: built.portal,
    rewardPosition: built.rewardPosition,
  };
}
