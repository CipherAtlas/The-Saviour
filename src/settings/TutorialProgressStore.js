export const TUTORIAL_PROGRESS_KEY = "the-saviour-tutorial-progress";
export const TUTORIAL_PROGRESS_VERSION = 2;

function defaultProgress() {
  return {
    version: TUTORIAL_PROGRESS_VERSION,
    dontShowAgain: false,
  };
}

function validProgress(candidate) {
  return Boolean(candidate)
    && typeof candidate === "object"
    && !Array.isArray(candidate)
    && Object.keys(candidate).length === 2
    && candidate.version === TUTORIAL_PROGRESS_VERSION
    && typeof candidate.dontShowAgain === "boolean";
}

function legacyProgress(candidate) {
  return Boolean(candidate)
    && typeof candidate === "object"
    && !Array.isArray(candidate)
    && candidate.version === 1
    && typeof candidate.completed === "boolean";
}

export class TutorialProgressStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this.storageError = null;
    this.values = this.load();
  }

  load() {
    if (!this.storage) return defaultProgress();
    let parsed;
    try {
      const raw = this.storage.getItem(TUTORIAL_PROGRESS_KEY);
      if (raw === null) return defaultProgress();
      parsed = JSON.parse(raw);
    } catch {
      this.storageError = "readUnavailable";
      return defaultProgress();
    }
    if (validProgress(parsed)) return { ...parsed };
    if (legacyProgress(parsed)) {
      const migrated = defaultProgress();
      try {
        this.storage.setItem(TUTORIAL_PROGRESS_KEY, JSON.stringify(migrated));
      } catch {
        this.storageError = "writeUnavailable";
      }
      return migrated;
    }
    this.storageError = "invalid";
    return defaultProgress();
  }

  isDismissed() {
    return this.values.dontShowAgain;
  }

  shouldShow() {
    return !this.isDismissed();
  }

  dismissForever() {
    if (this.values.dontShowAgain) return false;
    this.values.dontShowAgain = true;
    try {
      this.storage?.setItem?.(TUTORIAL_PROGRESS_KEY, JSON.stringify(this.values));
      this.storageError = null;
    } catch {
      this.storageError = "writeUnavailable";
    }
    return true;
  }

  getStatus() {
    return Object.freeze({ storageError: this.storageError });
  }
}
