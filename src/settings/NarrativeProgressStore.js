export const NARRATIVE_PROGRESS_KEY = "hollow-crown-progress";
export const NARRATIVE_PROGRESS_VERSION = 1;

function defaultProgress() {
  return {
    version: NARRATIVE_PROGRESS_VERSION,
    glossaryUnlocked: false,
  };
}

function snapshot(values) {
  return Object.freeze({ ...values });
}

export class NarrativeProgressStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.listeners = new Set();
    this.values = this.load();
  }

  load() {
    if (!this.storage) return defaultProgress();
    try {
      const candidate = JSON.parse(this.storage.getItem(NARRATIVE_PROGRESS_KEY));
      if (
        candidate?.version !== NARRATIVE_PROGRESS_VERSION ||
        typeof candidate.glossaryUnlocked !== "boolean"
      ) return defaultProgress();
      return {
        version: NARRATIVE_PROGRESS_VERSION,
        glossaryUnlocked: candidate.glossaryUnlocked,
      };
    } catch {
      return defaultProgress();
    }
  }

  isGlossaryUnlocked() {
    return this.values.glossaryUnlocked;
  }

  getSnapshot() {
    return snapshot(this.values);
  }

  unlockGlossary() {
    if (this.values.glossaryUnlocked) return false;
    this.values.glossaryUnlocked = true;
    this.persist();
    const current = this.getSnapshot();
    for (const listener of this.listeners) listener(current);
    return true;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  persist() {
    try {
      this.storage?.setItem(NARRATIVE_PROGRESS_KEY, JSON.stringify(this.values));
    } catch {
      // Progress remains available for the current session when storage is unavailable.
    }
  }
}
