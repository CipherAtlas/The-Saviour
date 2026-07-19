import { HARVEST_CONFIG } from "./gameConfig.js";

const GAIN_SOURCES = new Set(Object.keys(HARVEST_CONFIG.gainUnits));

function immutableResult(result) {
  return Object.freeze(result);
}

function sourceDetail(source) {
  if (typeof source === "string") return { type: source, eventId: null };
  if (!source || typeof source !== "object") return { type: null, eventId: null };
  return {
    type: source.type ?? source.source ?? null,
    eventId: source.eventId ?? source.sourceEventId ?? null,
  };
}

/**
 * @typedef {Readonly<{
 *   units: number,
 *   maxUnits: number,
 *   unitsPerSegment: number,
 *   filledSegments: number,
 *   segmentProgress: number,
 * }>} HarvestSnapshot
 */

export class HarvestState {
  constructor() {
    this.units = 0;
    this.rememberedEventIds = new Set();
    this.eventIdOrder = [];
  }

  resetRun() {
    this.units = 0;
    this.rememberedEventIds.clear();
    this.eventIdOrder.length = 0;
    return this.snapshot();
  }

  restoreUnits(units) {
    if (!Number.isInteger(units) || units < 0 || units > HARVEST_CONFIG.maxUnits) return false;
    this.units = units;
    this.rememberedEventIds.clear();
    this.eventIdOrder.length = 0;
    return true;
  }

  gain(source, amount = undefined) {
    const detail = sourceDetail(source);
    const configuredAmount = HARVEST_CONFIG.gainUnits[detail.type];
    const hasInvalidOverride = amount !== undefined && amount !== configuredAmount;
    if (!GAIN_SOURCES.has(detail.type) || hasInvalidOverride || !Number.isInteger(configuredAmount) || configuredAmount <= 0) {
      return immutableResult({ accepted: false, delta: 0, reason: "invalidGain", snapshot: this.snapshot() });
    }
    if (detail.eventId !== null && this.rememberedEventIds.has(`${detail.type}:${detail.eventId}`)) {
      return immutableResult({ accepted: false, delta: 0, reason: "duplicateEvent", snapshot: this.snapshot() });
    }
    if (this.units + configuredAmount > HARVEST_CONFIG.maxUnits) {
      return immutableResult({ accepted: false, delta: 0, reason: "capOverflow", snapshot: this.snapshot() });
    }

    this.units += configuredAmount;
    if (detail.eventId !== null) this.rememberEvent(`${detail.type}:${detail.eventId}`);
    return immutableResult({ accepted: true, delta: configuredAmount, snapshot: this.snapshot() });
  }

  trySpend(segments, reason) {
    if (!Number.isInteger(segments) || segments <= 0 || typeof reason !== "string" || reason.length === 0) {
      return immutableResult({ accepted: false, delta: 0, reason: "invalidSpend", snapshot: this.snapshot() });
    }
    const cost = segments * HARVEST_CONFIG.unitsPerSegment;
    if (cost > this.units) {
      return immutableResult({ accepted: false, delta: 0, reason: "insufficientUnits", snapshot: this.snapshot() });
    }
    this.units -= cost;
    return immutableResult({ accepted: true, delta: -cost, snapshot: this.snapshot() });
  }

  ensureFloorMinimum() {
    if (this.units !== 0) {
      return immutableResult({ granted: false, delta: 0, snapshot: this.snapshot() });
    }
    this.units = HARVEST_CONFIG.floorMinimumUnits;
    return immutableResult({ granted: true, delta: HARVEST_CONFIG.floorMinimumUnits, snapshot: this.snapshot() });
  }

  snapshot() {
    return Object.freeze({
      units: this.units,
      maxUnits: HARVEST_CONFIG.maxUnits,
      unitsPerSegment: HARVEST_CONFIG.unitsPerSegment,
      filledSegments: Math.floor(this.units / HARVEST_CONFIG.unitsPerSegment),
      segmentProgress: (this.units % HARVEST_CONFIG.unitsPerSegment) / HARVEST_CONFIG.unitsPerSegment,
    });
  }

  rememberEvent(key) {
    this.rememberedEventIds.add(key);
    this.eventIdOrder.push(key);
    if (this.eventIdOrder.length <= HARVEST_CONFIG.rememberedEventIds) return;
    this.rememberedEventIds.delete(this.eventIdOrder.shift());
  }
}
