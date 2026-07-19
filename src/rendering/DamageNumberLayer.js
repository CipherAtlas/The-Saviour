import * as THREE from "three";
import { getEnemyVisualProfile } from "./enemyVisualProfiles.js";

export const DAMAGE_NUMBER_CAPACITY = 48;
export const DAMAGE_NUMBER_LANES = Object.freeze([0, -18, 18, -36, 36]);
export const DAMAGE_NUMBER_AGGREGATE_WINDOW = 0.12;
export const DAMAGE_NUMBER_MAX_RESIDENCE = 1.2;

export const DAMAGE_NUMBER_STYLES = Object.freeze({
  normal: Object.freeze({ lifetime: 0.72, priority: 1 }),
  critical: Object.freeze({ lifetime: 0.9, priority: 4 }),
  blocked: Object.freeze({ lifetime: 0.62, priority: 2 }),
  player: Object.freeze({ lifetime: 0.82, priority: 5 }),
  heal: Object.freeze({ lifetime: 0.9, priority: 4 }),
  revive: Object.freeze({ lifetime: 0.9, priority: 5 }),
});

const CLEAR_PHASES = new Set([
  "portalTraversal",
  "roomLoadError",
  "title",
  "dead",
  "victory",
  "endingChoice",
  "endingStrike",
  "endingFade",
  "endingComplete",
]);
const DEFERRED_HEAL_REASONS = new Set(["blessing", "floorRecovery"]);
const NDC_PADDING = 0.16;
const EDGE_SAFE_X = 44;
const EDGE_SAFE_Y = 26;

function finitePosition(position) {
  return position && Number.isFinite(position.x) && Number.isFinite(position.z);
}

function roundedAmount(value) {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : null;
}

export function formatDamageNumberText(taxonomy, amount, count = 1) {
  const rounded = roundedAmount(amount);
  if (rounded === null || !DAMAGE_NUMBER_STYLES[taxonomy]) return null;
  const suffix = count > 1 ? ` ×${count}` : "";
  if (taxonomy === "blocked") return `[ BLOCK ]${suffix}`;
  if (taxonomy === "critical") return `✦ CRIT −${rounded}${suffix}`;
  if (taxonomy === "player") return `▼ −${rounded}${suffix}`;
  if (taxonomy === "heal") return `✚ +${rounded}${suffix}`;
  if (taxonomy === "revive") return `◉ REVIVE +${rounded}${suffix}`;
  return `−${rounded}${suffix}`;
}

export function writeDamageNumberModel(event, output = {}) {
  const detail = event?.detail;
  if (!detail || typeof detail !== "object" || !finitePosition(detail.position)) return null;
  let taxonomy;
  let amount;
  let targetId;
  let anchorY;
  let eventId = null;
  let reason = null;
  let deferAcrossArena = false;

  if (event.type === "enemyHit") {
    amount = roundedAmount(detail.damage);
    if (amount === null || detail.id === null || detail.id === undefined) return null;
    taxonomy = detail.blocked ? "blocked" : detail.critical ? "critical" : "normal";
    targetId = `enemy:${detail.id}`;
    try {
      anchorY = getEnemyVisualProfile(detail.type).healthBar.height;
    } catch {
      return null;
    }
  } else if (event.type === "playerHit") {
    amount = roundedAmount(detail.appliedAmount ?? detail.amount);
    if (amount === null) return null;
    taxonomy = "player";
    targetId = "player";
    anchorY = 2.75;
  } else if (event.type === "playerHealed") {
    amount = roundedAmount(detail.amount);
    if (amount === null || typeof detail.healingId !== "string" || detail.targetId !== "player") return null;
    taxonomy = detail.reason === "deathDefiance" ? "revive" : "heal";
    targetId = "player";
    anchorY = 2.75;
    eventId = detail.healingId;
    reason = detail.reason ?? null;
    deferAcrossArena = DEFERRED_HEAL_REASONS.has(reason);
  } else {
    return null;
  }

  const direction = detail.direction;
  output.taxonomy = taxonomy;
  output.amount = amount;
  output.count = 1;
  output.targetId = targetId;
  output.eventId = eventId;
  output.reason = reason;
  output.x = detail.position.x;
  output.y = anchorY;
  output.z = detail.position.z;
  output.directionX = Number.isFinite(direction?.x) ? direction.x : 0;
  output.directionZ = Number.isFinite(direction?.z) ? direction.z : 0;
  output.lifetime = DAMAGE_NUMBER_STYLES[taxonomy].lifetime;
  output.priority = DAMAGE_NUMBER_STYLES[taxonomy].priority;
  output.deferAcrossArena = deferAcrossArena;
  return output;
}

export function damageNumberModel(event) {
  const output = writeDamageNumberModel(event, {});
  return output ? Object.freeze({ ...output }) : null;
}

export function projectDamageAnchor(ndc, bounds, offsetX = 0, offsetY = 0) {
  if (
    !ndc
    || !bounds
    || !Number.isFinite(ndc.x)
    || !Number.isFinite(ndc.y)
    || !Number.isFinite(ndc.z)
    || !Number.isFinite(bounds.left)
    || !Number.isFinite(bounds.top)
    || !Number.isFinite(bounds.width)
    || !Number.isFinite(bounds.height)
    || bounds.width <= 0
    || bounds.height <= 0
  ) return Object.freeze({ visible: false, x: 0, y: 0 });
  if (
    ndc.z < -1
    || ndc.z > 1
    || ndc.x < -1 - NDC_PADDING
    || ndc.x > 1 + NDC_PADDING
    || ndc.y < -1 - NDC_PADDING
    || ndc.y > 1 + NDC_PADDING
  ) return Object.freeze({ visible: false, x: 0, y: 0 });
  const rawX = bounds.left + (ndc.x + 1) * 0.5 * bounds.width + offsetX;
  const rawY = bounds.top + (1 - ndc.y) * 0.5 * bounds.height + offsetY;
  return Object.freeze({
    visible: true,
    x: Math.max(bounds.left + EDGE_SAFE_X, Math.min(bounds.left + bounds.width - EDGE_SAFE_X, rawX)),
    y: Math.max(bounds.top + EDGE_SAFE_Y, Math.min(bounds.top + bounds.height - EDGE_SAFE_Y, rawY)),
  });
}

function createRecord(node = null) {
  return {
    node,
    active: false,
    taxonomy: "normal",
    amount: 0,
    count: 0,
    targetId: null,
    eventId: null,
    reason: null,
    x: 0,
    y: 0,
    z: 0,
    directionX: 0,
    directionZ: 0,
    elapsed: 0,
    lifetime: DAMAGE_NUMBER_STYLES.normal.lifetime,
    priority: DAMAGE_NUMBER_STYLES.normal.priority,
    lane: 0,
    serial: 0,
    deferAcrossArena: false,
  };
}

function copyModel(target, source) {
  target.taxonomy = source.taxonomy;
  target.amount = source.amount;
  target.count = source.count ?? 1;
  target.targetId = source.targetId;
  target.eventId = source.eventId;
  target.reason = source.reason;
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
  target.directionX = source.directionX;
  target.directionZ = source.directionZ;
  target.lifetime = source.lifetime;
  target.priority = source.priority;
  target.deferAcrossArena = source.deferAcrossArena;
}

export class DamageNumberLayer {
  constructor(root, canvas, initialSettings = null) {
    if (!root || !canvas) throw new TypeError("DamageNumberLayer requires an overlay root and canvas");
    this.root = root;
    this.canvas = canvas;
    this.records = new Array(DAMAGE_NUMBER_CAPACITY);
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < DAMAGE_NUMBER_CAPACITY; index += 1) {
      const node = document.createElement("span");
      node.className = "damage-number";
      node.dataset.active = "false";
      node.style.opacity = "0";
      fragment.append(node);
      this.records[index] = createRecord(node);
    }
    this.root.append(fragment);
    this.candidate = createRecord();
    this.pending = createRecord();
    this.projectedVector = new THREE.Vector3();
    this.bounds = { left: 0, top: 0, width: 1, height: 1 };
    this.serial = 0;
    this.enabled = true;
    this.uiScale = 1;
    this.reducedMotion = false;
    this.stats = {
      peak: 0,
      dropped: 0,
      replaced: 0,
      aggregated: 0,
      projected: 0,
    };
    this.resize();
    if (initialSettings) this.applySettings(initialSettings);
  }

  resize(bounds = null) {
    const next = bounds ?? this.canvas.getBoundingClientRect();
    this.bounds.left = Number.isFinite(next.left) ? next.left : 0;
    this.bounds.top = Number.isFinite(next.top) ? next.top : 0;
    this.bounds.width = Math.max(1, Number(next.width) || this.canvas.clientWidth || 1);
    this.bounds.height = Math.max(1, Number(next.height) || this.canvas.clientHeight || 1);
  }

  applySettings(values) {
    const enabled = values?.gameplay?.damageNumbers !== false;
    this.uiScale = Math.max(0.8, Math.min(1.35, Number(values?.accessibility?.uiScale) || 1));
    this.reducedMotion = values?.camera?.reducedMotion === true;
    this.root.dataset.contrast = values?.accessibility?.highContrast ? "high" : "standard";
    this.root.dataset.palette = values?.accessibility?.colorPalette ?? "default";
    this.root.style.setProperty("--damage-ui-scale", String(this.uiScale));
    if (this.enabled && !enabled) this.clear(true);
    this.enabled = enabled;
  }

  handleEvent(event, game = null) {
    const type = event?.type;
    if (type === "runStarted") {
      this.clear(true);
      return false;
    }
    if (type === "arenaChanged") {
      this.capturePendingHeal();
      this.clear(false);
      return false;
    }
    if (type === "roomReady") return this.releasePendingHeal(game?.player?.position);
    if (type === "roomLoadFailed") {
      this.clear(true);
      return false;
    }
    if (type === "phaseChanged") {
      const phase = event.detail?.phase;
      if (phase === "roomLoading") this.clear(false);
      else if (CLEAR_PHASES.has(phase)) this.clear(true);
      return false;
    }
    if (!this.enabled || !writeDamageNumberModel(event, this.candidate)) return false;
    return this.spawn(this.candidate);
  }

  spawn(model) {
    if (!this.enabled) return false;
    if (model.eventId !== null && this.hasEventId(model.eventId)) return false;
    const aggregate = this.findAggregate(model);
    if (aggregate) {
      aggregate.amount += model.amount;
      aggregate.count += model.count ?? 1;
      aggregate.eventId = model.eventId;
      aggregate.deferAcrossArena ||= model.deferAcrossArena;
      aggregate.node.textContent = formatDamageNumberText(aggregate.taxonomy, aggregate.amount, aggregate.count);
      this.stats.aggregated += 1;
      return true;
    }

    let record = this.findInactive();
    if (!record) {
      record = this.findReplacementCandidate();
      const progress = record.elapsed / Math.max(0.001, record.lifetime);
      if (model.priority < record.priority || (model.priority === record.priority && progress < 0.5)) {
        this.stats.dropped += 1;
        return false;
      }
      this.stats.replaced += 1;
    }
    this.activate(record, model);
    return true;
  }

  activate(record, model) {
    copyModel(record, model);
    record.lane = this.nextLane(record.targetId);
    record.active = true;
    record.elapsed = 0;
    record.serial = ++this.serial;
    record.node.dataset.active = "true";
    record.node.dataset.taxonomy = record.taxonomy;
    record.node.textContent = formatDamageNumberText(record.taxonomy, record.amount, record.count);
    record.node.style.opacity = "1";
    const active = this.activeCount();
    if (active > this.stats.peak) this.stats.peak = active;
  }

  hasEventId(eventId) {
    if (this.pending.active && this.pending.eventId === eventId) return true;
    for (let index = 0; index < this.records.length; index += 1) {
      if (this.records[index].active && this.records[index].eventId === eventId) return true;
    }
    return false;
  }

  findAggregate(model) {
    for (let index = 0; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (
        record.active
        && record.targetId === model.targetId
        && record.taxonomy === model.taxonomy
        && record.elapsed <= DAMAGE_NUMBER_AGGREGATE_WINDOW
      ) return record;
    }
    return null;
  }

  findInactive() {
    for (let index = 0; index < this.records.length; index += 1) {
      if (!this.records[index].active) return this.records[index];
    }
    return null;
  }

  findReplacementCandidate() {
    let candidate = this.records[0];
    for (let index = 1; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (record.priority < candidate.priority) candidate = record;
      else if (record.priority === candidate.priority) {
        const progress = record.elapsed / Math.max(0.001, record.lifetime);
        const candidateProgress = candidate.elapsed / Math.max(0.001, candidate.lifetime);
        if (progress > candidateProgress || (progress === candidateProgress && record.serial < candidate.serial)) {
          candidate = record;
        }
      }
    }
    return candidate;
  }

  nextLane(targetId) {
    let count = 0;
    for (let index = 0; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (record.active && record.targetId === targetId) count += 1;
    }
    return count % DAMAGE_NUMBER_LANES.length;
  }

  capturePendingHeal() {
    this.pending.active = false;
    let newest = null;
    for (let index = 0; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (record.active && record.deferAcrossArena && (!newest || record.serial > newest.serial)) newest = record;
    }
    if (!newest) return;
    copyModel(this.pending, newest);
    this.pending.active = true;
  }

  releasePendingHeal(position) {
    if (!this.enabled || !this.pending.active || !finitePosition(position)) return false;
    this.pending.x = position.x;
    this.pending.y = 2.75;
    this.pending.z = position.z;
    this.pending.active = false;
    const accepted = this.spawn(this.pending);
    return accepted;
  }

  update(dt, camera, { phase = "playing", hitStopActive = false } = {}) {
    const frozen = phase === "paused" || hitStopActive;
    const delta = Number.isFinite(dt) && dt > 0 && !frozen ? dt : 0;
    let projected = 0;
    for (let index = 0; index < this.records.length; index += 1) {
      const record = this.records[index];
      if (!record.active) continue;
      record.elapsed += delta;
      if (record.elapsed >= Math.min(DAMAGE_NUMBER_MAX_RESIDENCE, record.lifetime)) {
        this.release(record);
        continue;
      }
      const progress = Math.max(0, Math.min(1, record.elapsed / record.lifetime));
      const vector = this.projectedVector.set(record.x, record.y, record.z).project(camera);
      if (
        vector.z < -1
        || vector.z > 1
        || vector.x < -1 - NDC_PADDING
        || vector.x > 1 + NDC_PADDING
        || vector.y < -1 - NDC_PADDING
        || vector.y > 1 + NDC_PADDING
      ) {
        record.node.style.opacity = "0";
        continue;
      }
      const lane = DAMAGE_NUMBER_LANES[record.lane] * this.uiScale;
      const eased = 1 - ((1 - progress) ** 3);
      let motionX = 0;
      let motionY = -34 * eased;
      let scale = 1 + Math.sin(Math.min(1, progress / 0.42) * Math.PI) * 0.1;
      if (record.taxonomy === "critical") {
        motionX = record.directionX * 18 * eased;
        motionY = -48 * eased;
        scale = 1 + Math.sin(Math.min(1, progress / 0.46) * Math.PI) * 0.28;
      } else if (record.taxonomy === "blocked") {
        motionX = -record.directionX * 14 * eased;
        motionY = -18 * eased;
        scale = 1 + Math.sin(Math.min(1, progress / 0.35) * Math.PI) * 0.08;
      } else if (record.taxonomy === "player") {
        motionX = record.directionX * 12 * eased;
        motionY = 24 * eased;
        scale = 1 + Math.sin(Math.min(1, progress / 0.4) * Math.PI) * 0.14;
      } else if (record.taxonomy === "heal") {
        motionY = -40 * eased;
        scale = 1 + Math.sin(Math.min(1, progress / 0.4) * Math.PI) * 0.16;
      } else if (record.taxonomy === "revive") {
        motionY = -12 * eased;
        scale = 0.86 + eased * 0.24 + Math.sin(Math.min(1, progress / 0.42) * Math.PI) * 0.12;
      }
      if (this.reducedMotion) {
        motionX = 0;
        motionY = Math.max(-8, Math.min(8, motionY));
        scale = 1;
      }
      const rawX = this.bounds.left + (vector.x + 1) * 0.5 * this.bounds.width + lane + motionX;
      const rawY = this.bounds.top + (1 - vector.y) * 0.5 * this.bounds.height + motionY;
      const x = Math.max(this.bounds.left + EDGE_SAFE_X, Math.min(this.bounds.left + this.bounds.width - EDGE_SAFE_X, rawX));
      const y = Math.max(this.bounds.top + EDGE_SAFE_Y, Math.min(this.bounds.top + this.bounds.height - EDGE_SAFE_Y, rawY));
      const fade = progress <= 0.58 ? 1 : Math.max(0, 1 - (progress - 0.58) / 0.42);
      record.node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale * this.uiScale})`;
      record.node.style.opacity = String(fade);
      projected += 1;
    }
    this.stats.projected = projected;
  }

  release(record) {
    record.active = false;
    record.eventId = null;
    record.node.style.opacity = "0";
  }

  clear(clearPending = true) {
    for (let index = 0; index < this.records.length; index += 1) {
      if (this.records[index].active) this.release(this.records[index]);
    }
    if (clearPending) this.pending.active = false;
    this.stats.projected = 0;
  }

  activeCount() {
    let active = 0;
    for (let index = 0; index < this.records.length; index += 1) {
      if (this.records[index].active) active += 1;
    }
    return active;
  }

  metrics() {
    return Object.freeze({
      active: this.activeCount(),
      capacity: DAMAGE_NUMBER_CAPACITY,
      peak: this.stats.peak,
      dropped: this.stats.dropped,
      replaced: this.stats.replaced,
      aggregated: this.stats.aggregated,
      domNodes: DAMAGE_NUMBER_CAPACITY,
      projected: this.stats.projected,
    });
  }
}
