import { NARRATIVE_SEQUENCES } from "../game/dialogueContent.js";

export const NARRATIVE_PROGRESS_KEY = "hollow-crown-progress";
export const NARRATIVE_PROGRESS_VERSION = 2;

function validRegistryIds(registry) {
  const sequenceIds = new Set(Object.keys(registry));
  const beatIds = new Set(
    Object.values(registry).flatMap((sequence) => sequence.beats.map((beat) => beat.id)),
  );
  return { sequenceIds, beatIds };
}

function defaultProgress() {
  return {
    glossaryUnlocked: false,
    readBeatIds: new Set(),
    completedSequenceIds: new Set(),
  };
}

function sorted(values) {
  return [...values].sort();
}

function snapshot(values) {
  return Object.freeze({
    version: NARRATIVE_PROGRESS_VERSION,
    glossaryUnlocked: values.glossaryUnlocked,
    readBeatIds: Object.freeze(sorted(values.readBeatIds)),
    completedSequenceIds: Object.freeze(sorted(values.completedSequenceIds)),
  });
}

function validIdArray(value) {
  return Array.isArray(value) && value.every((id) => typeof id === "string");
}

export class NarrativeProgressStore {
  constructor(storage = globalThis.localStorage, registry = NARRATIVE_SEQUENCES) {
    this.storage = storage;
    this.listeners = new Set();
    const ids = validRegistryIds(registry);
    this.validSequenceIds = ids.sequenceIds;
    this.validBeatIds = ids.beatIds;
    this.values = this.load();
  }

  load() {
    if (!this.storage) return defaultProgress();

    try {
      const serialized = this.storage.getItem(NARRATIVE_PROGRESS_KEY);
      if (serialized === null) return defaultProgress();
      const candidate = JSON.parse(serialized);

      if (
        candidate?.version === 1
        && typeof candidate.glossaryUnlocked === "boolean"
      ) {
        return {
          glossaryUnlocked: candidate.glossaryUnlocked,
          readBeatIds: new Set(),
          completedSequenceIds: new Set(),
        };
      }

      if (
        candidate?.version !== NARRATIVE_PROGRESS_VERSION
        || typeof candidate.glossaryUnlocked !== "boolean"
        || !validIdArray(candidate.readBeatIds)
        || !validIdArray(candidate.completedSequenceIds)
      ) {
        return defaultProgress();
      }

      return {
        glossaryUnlocked: candidate.glossaryUnlocked,
        readBeatIds: new Set(candidate.readBeatIds.filter((id) => this.validBeatIds.has(id))),
        completedSequenceIds: new Set(
          candidate.completedSequenceIds.filter((id) => this.validSequenceIds.has(id)),
        ),
      };
    } catch {
      return defaultProgress();
    }
  }

  isGlossaryUnlocked() {
    return this.values.glossaryUnlocked;
  }

  isBeatRead(beatId) {
    return this.values.readBeatIds.has(beatId);
  }

  isSequenceCompleted(sequenceId) {
    return this.values.completedSequenceIds.has(sequenceId);
  }

  getSnapshot() {
    return snapshot(this.values);
  }

  unlockGlossary() {
    if (this.values.glossaryUnlocked) return false;
    this.values.glossaryUnlocked = true;
    this.commit();
    return true;
  }

  markRead(beatId) {
    if (!this.validBeatIds.has(beatId) || this.values.readBeatIds.has(beatId)) return false;
    this.values.readBeatIds.add(beatId);
    this.commit();
    return true;
  }

  markCompleted(sequenceId) {
    if (
      !this.validSequenceIds.has(sequenceId)
      || this.values.completedSequenceIds.has(sequenceId)
    ) return false;
    this.values.completedSequenceIds.add(sequenceId);
    this.commit();
    return true;
  }

  resetReadState() {
    if (
      this.values.readBeatIds.size === 0
      && this.values.completedSequenceIds.size === 0
    ) {
      return false;
    }

    this.values.readBeatIds.clear();
    this.values.completedSequenceIds.clear();
    this.commit();
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  commit() {
    this.persist();
    const current = this.getSnapshot();
    for (const listener of this.listeners) listener(current);
  }

  persist() {
    try {
      this.storage?.setItem(
        NARRATIVE_PROGRESS_KEY,
        JSON.stringify(this.getSnapshot()),
      );
    } catch {
      // Valid progress remains available for the current session.
    }
  }
}
