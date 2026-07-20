const DEFAULT_SAMPLE_STEP = 0.32;
const CIRCLE_SAMPLES = 32;
const EPSILON = 1e-6;

function finite(value, label) {
  if (!Number.isFinite(value)) throw new TypeError(`${label} must be finite.`);
  return value;
}

function positive(value, label) {
  finite(value, label);
  if (value <= 0) throw new RangeError(`${label} must be positive.`);
  return value;
}

function freezeRegion(region, index) {
  const value = {
    id: String(region.id ?? `region-${index + 1}`),
    role: region.role ?? "combat",
    x: finite(region.x, "Region x"),
    z: finite(region.z, "Region z"),
    width: positive(region.width, "Region width"),
    depth: positive(region.depth, "Region depth"),
  };
  return Object.freeze(value);
}

function freezeConnector(connector, index) {
  return Object.freeze({
    id: String(connector.id ?? `connector-${index + 1}`),
    from: String(connector.from),
    to: String(connector.to),
    width: positive(connector.width, "Connector width"),
  });
}

export function createWalkableShape({ regions, majorRegionIds = [], connectors = [] }) {
  if (!Array.isArray(regions) || regions.length === 0) {
    throw new TypeError("A walkable shape requires at least one authored region.");
  }
  const frozenRegions = Object.freeze(regions.map(freezeRegion));
  const regionIds = new Set(frozenRegions.map((region) => region.id));
  if (regionIds.size !== frozenRegions.length) throw new TypeError("Walkable region IDs must be unique.");
  const frozenMajorIds = Object.freeze(
    (majorRegionIds.length > 0 ? majorRegionIds : frozenRegions.filter((region) => region.role === "combat").map((region) => region.id))
      .map(String),
  );
  if (frozenMajorIds.some((id) => !regionIds.has(id))) throw new TypeError("Major region IDs must name authored regions.");
  const frozenConnectors = Object.freeze(connectors.map(freezeConnector));
  if (frozenConnectors.some((connector) => !regionIds.has(connector.from) || !regionIds.has(connector.to))) {
    throw new TypeError("Connectors must reference authored regions.");
  }
  return Object.freeze({
    kind: "regionUnion",
    regions: frozenRegions,
    majorRegionIds: frozenMajorIds,
    connectors: frozenConnectors,
  });
}

function shapeFrom(subject) {
  if (subject?.walkableShape?.kind === "regionUnion") return subject.walkableShape;
  if (subject?.kind === "regionUnion") return subject;
  if (Number.isFinite(subject?.width) && Number.isFinite(subject?.depth)) {
    return createWalkableShape({
      regions: [{ id: "legacy-bounds", role: "combat", x: 0, z: 0, width: subject.width, depth: subject.depth }],
      majorRegionIds: ["legacy-bounds"],
    });
  }
  throw new TypeError("Arena geometry requires a walkableShape contract.");
}

function regionBounds(region) {
  return {
    minX: region.x - region.width / 2,
    maxX: region.x + region.width / 2,
    minZ: region.z - region.depth / 2,
    maxZ: region.z + region.depth / 2,
  };
}

function pointInRegion(point, region) {
  return Math.abs(point.x - region.x) <= region.width / 2 + EPSILON
    && Math.abs(point.z - region.z) <= region.depth / 2 + EPSILON;
}

function circleInRegion(point, region, radius) {
  return Math.abs(point.x - region.x) <= region.width / 2 - radius + EPSILON
    && Math.abs(point.z - region.z) <= region.depth / 2 - radius + EPSILON;
}

export function getWalkableRegions(subject) {
  return shapeFrom(subject).regions;
}

export function isPointWalkable(subject, point) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  return shapeFrom(subject).regions.some((region) => pointInRegion(point, region));
}

export function isCircleWalkable(subject, point, radius = 0) {
  if (!Number.isFinite(radius) || radius < 0 || !point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
  const regions = shapeFrom(subject).regions;
  if (!regions.some((region) => pointInRegion(point, region))) return false;
  if (radius <= EPSILON) return true;
  if (regions.some((region) => circleInRegion(point, region, radius))) return true;
  for (let index = 0; index < CIRCLE_SAMPLES; index += 1) {
    const angle = (index / CIRCLE_SAMPLES) * Math.PI * 2;
    const sample = {
      x: point.x + Math.cos(angle) * radius,
      z: point.z + Math.sin(angle) * radius,
    };
    if (!regions.some((region) => pointInRegion(sample, region))) return false;
  }
  return true;
}

export function walkableClearanceAt(subject, point, maxRadius = 32) {
  if (!isPointWalkable(subject, point)) return 0;
  let low = 0;
  let high = Math.max(0, maxRadius);
  for (let iteration = 0; iteration < 18; iteration += 1) {
    const middle = (low + high) / 2;
    if (isCircleWalkable(subject, point, middle)) low = middle;
    else high = middle;
  }
  return low;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function candidateInsideRegion(point, region, radius) {
  const bounds = regionBounds(region);
  const minX = bounds.minX + radius;
  const maxX = bounds.maxX - radius;
  const minZ = bounds.minZ + radius;
  const maxZ = bounds.maxZ - radius;
  if (minX > maxX || minZ > maxZ) return null;
  return { x: clamp(point.x, minX, maxX), z: clamp(point.z, minZ, maxZ) };
}

export function nearestWalkablePoint(subject, point, radius = 0) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
    throw new TypeError("Nearest-point queries require a finite point.");
  }
  if (!Number.isFinite(radius) || radius < 0) throw new RangeError("Nearest-point radius must be non-negative.");
  if (isCircleWalkable(subject, point, radius)) return { x: point.x, z: point.z };

  const candidates = getWalkableRegions(subject)
    .map((region) => candidateInsideRegion(point, region, radius))
    .filter((candidate) => candidate && isCircleWalkable(subject, candidate, radius))
    .sort((left, right) => (
      Math.hypot(left.x - point.x, left.z - point.z) - Math.hypot(right.x - point.x, right.z - point.z)
      || left.x - right.x
      || left.z - right.z
    ));
  if (candidates.length > 0) return candidates[0];

  for (let ring = 1; ring <= 160; ring += 1) {
    const distance = ring * 0.25;
    for (let index = 0; index < 32; index += 1) {
      const angle = (index / 32) * Math.PI * 2;
      const candidate = { x: point.x + Math.cos(angle) * distance, z: point.z + Math.sin(angle) * distance };
      if (isCircleWalkable(subject, candidate, radius)) return candidate;
    }
  }
  throw new RangeError("Walkable shape cannot contain the requested actor radius.");
}

export function isWalkableSegment(subject, start, end, radius = 0, step = DEFAULT_SAMPLE_STEP) {
  if (!start || !end || !Number.isFinite(start.x) || !Number.isFinite(start.z)
    || !Number.isFinite(end.x) || !Number.isFinite(end.z)) return false;
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  const samples = Math.max(1, Math.ceil(length / Math.max(0.05, step)));
  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / samples;
    if (!isCircleWalkable(subject, {
      x: start.x + (end.x - start.x) * ratio,
      z: start.z + (end.z - start.z) * ratio,
    }, radius)) return false;
  }
  return true;
}

function shapeBounds(subject) {
  const regions = getWalkableRegions(subject);
  const bounds = regions.map(regionBounds);
  return {
    minX: Math.min(...bounds.map((entry) => entry.minX)),
    maxX: Math.max(...bounds.map((entry) => entry.maxX)),
    minZ: Math.min(...bounds.map((entry) => entry.minZ)),
    maxZ: Math.max(...bounds.map((entry) => entry.maxZ)),
  };
}

export function createNavigationCells(subject, { cellSize = 1, clearance = 0 } = {}) {
  positive(cellSize, "Navigation cell size");
  const bounds = shapeBounds(subject);
  const cells = [];
  const minColumn = Math.ceil(bounds.minX / cellSize);
  const maxColumn = Math.floor(bounds.maxX / cellSize);
  const minRow = Math.ceil(bounds.minZ / cellSize);
  const maxRow = Math.floor(bounds.maxZ / cellSize);
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let column = minColumn; column <= maxColumn; column += 1) {
      const point = { x: column * cellSize, z: row * cellSize };
      if (isCircleWalkable(subject, point, clearance)) cells.push(Object.freeze({ column, row, x: point.x, z: point.z }));
    }
  }
  return Object.freeze(cells);
}

function intervalUnionLength(intervals) {
  if (intervals.length === 0) return 0;
  const sorted = intervals.map((entry) => [...entry]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let total = 0;
  let [start, end] = sorted[0];
  for (let index = 1; index < sorted.length; index += 1) {
    const [nextStart, nextEnd] = sorted[index];
    if (nextStart <= end) end = Math.max(end, nextEnd);
    else {
      total += end - start;
      [start, end] = [nextStart, nextEnd];
    }
  }
  return total + end - start;
}

export function walkableArea(subject) {
  const regions = getWalkableRegions(subject);
  const xEdges = [...new Set(regions.flatMap((region) => {
    const bounds = regionBounds(region);
    return [bounds.minX, bounds.maxX];
  }))].sort((a, b) => a - b);
  let area = 0;
  for (let index = 0; index < xEdges.length - 1; index += 1) {
    const left = xEdges[index];
    const right = xEdges[index + 1];
    const middle = (left + right) / 2;
    const intervals = regions.filter((region) => {
      const bounds = regionBounds(region);
      return middle > bounds.minX && middle < bounds.maxX;
    }).map((region) => {
      const bounds = regionBounds(region);
      return [bounds.minZ, bounds.maxZ];
    });
    area += (right - left) * intervalUnionLength(intervals);
  }
  return area;
}

function segmentKey(segment) {
  return [segment.axis, segment.start.x, segment.start.z, segment.end.x, segment.end.z, segment.normal.x, segment.normal.z].join(":");
}

function rawPerimeterSegments(subject) {
  const regions = getWalkableRegions(subject);
  const xEdges = [...new Set(regions.flatMap((region) => {
    const bounds = regionBounds(region);
    return [bounds.minX, bounds.maxX];
  }))].sort((a, b) => a - b);
  const zEdges = [...new Set(regions.flatMap((region) => {
    const bounds = regionBounds(region);
    return [bounds.minZ, bounds.maxZ];
  }))].sort((a, b) => a - b);
  const result = new Map();
  const offset = 0.001;

  for (const z of zEdges) {
    for (let index = 0; index < xEdges.length - 1; index += 1) {
      const startX = xEdges[index];
      const endX = xEdges[index + 1];
      const x = (startX + endX) / 2;
      const below = isPointWalkable(subject, { x, z: z - offset });
      const above = isPointWalkable(subject, { x, z: z + offset });
      if (below === above) continue;
      const segment = {
        axis: "horizontal",
        start: { x: startX, z },
        end: { x: endX, z },
        normal: { x: 0, z: below ? 1 : -1 },
      };
      result.set(segmentKey(segment), segment);
    }
  }
  for (const x of xEdges) {
    for (let index = 0; index < zEdges.length - 1; index += 1) {
      const startZ = zEdges[index];
      const endZ = zEdges[index + 1];
      const z = (startZ + endZ) / 2;
      const left = isPointWalkable(subject, { x: x - offset, z });
      const right = isPointWalkable(subject, { x: x + offset, z });
      if (left === right) continue;
      const segment = {
        axis: "vertical",
        start: { x, z: startZ },
        end: { x, z: endZ },
        normal: { x: left ? 1 : -1, z: 0 },
      };
      result.set(segmentKey(segment), segment);
    }
  }
  return [...result.values()];
}

export function getPerimeterWallSegments(subject) {
  const raw = rawPerimeterSegments(subject).sort((left, right) => (
    left.axis.localeCompare(right.axis)
    || left.normal.x - right.normal.x
    || left.normal.z - right.normal.z
    || left.start.z - right.start.z
    || left.start.x - right.start.x
  ));
  const merged = [];
  for (const segment of raw) {
    const previous = merged.at(-1);
    const sameLine = previous
      && previous.axis === segment.axis
      && previous.normal.x === segment.normal.x
      && previous.normal.z === segment.normal.z
      && (segment.axis === "horizontal"
        ? previous.start.z === segment.start.z && Math.abs(previous.end.x - segment.start.x) <= EPSILON
        : previous.start.x === segment.start.x && Math.abs(previous.end.z - segment.start.z) <= EPSILON);
    if (sameLine) previous.end = { ...segment.end };
    else merged.push({ ...segment, start: { ...segment.start }, end: { ...segment.end } });
  }
  return Object.freeze(merged.map((segment, index) => Object.freeze({
    id: `perimeter-${index + 1}`,
    start: Object.freeze(segment.start),
    end: Object.freeze(segment.end),
    normal: Object.freeze(segment.normal),
    length: Math.hypot(segment.end.x - segment.start.x, segment.end.z - segment.start.z),
  })));
}
