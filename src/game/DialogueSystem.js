import { CHARACTERS, NARRATIVE_SEQUENCES } from "./dialogueContent.js";

export const DIALOGUE_READER_TIMING = Object.freeze({
  textCharactersPerSecond: 40,
  fastForwardCharactersPerSecond: 240,
  autoDelayMs: 1400,
});

const COMMANDS = new Set([
  "advance",
  "toggleAuto",
  "fastForwardStart",
  "fastForwardEnd",
  "openBacklog",
  "closeBacklog",
  "toggleUi",
  "requestSceneSkip",
  "confirmSceneSkip",
  "cancel",
]);

const MARK_OR_VARIATION = /[\p{Mark}\uFE0E\uFE0F]/u;
const EMOJI_MODIFIER = /[\u{1F3FB}-\u{1F3FF}]/u;
const REGIONAL_INDICATOR = /[\u{1F1E6}-\u{1F1FF}]/u;

function fallbackGraphemes(text) {
  const clusters = [];
  let joinNext = false;

  for (const point of Array.from(text)) {
    if (clusters.length === 0) {
      clusters.push(point);
      continue;
    }

    const previous = clusters[clusters.length - 1];
    if (point === "\u200D") {
      clusters[clusters.length - 1] = previous + point;
      joinNext = true;
      continue;
    }

    if (joinNext || MARK_OR_VARIATION.test(point) || EMOJI_MODIFIER.test(point)) {
      clusters[clusters.length - 1] = previous + point;
      joinNext = false;
      continue;
    }

    if (
      REGIONAL_INDICATOR.test(point)
      && REGIONAL_INDICATOR.test(Array.from(previous).at(-1))
      && Array.from(previous).filter((value) => REGIONAL_INDICATOR.test(value)).length % 2 === 1
    ) {
      clusters[clusters.length - 1] = previous + point;
      continue;
    }

    clusters.push(point);
  }

  return clusters;
}

function createSegmenter() {
  try {
    return typeof Intl?.Segmenter === "function"
      ? new Intl.Segmenter("en", { granularity: "grapheme" })
      : null;
  } catch {
    return null;
  }
}

const GRAPHEME_SEGMENTER = createSegmenter();

export function segmentGraphemes(text) {
  if (GRAPHEME_SEGMENTER) {
    return [...GRAPHEME_SEGMENTER.segment(text)].map(({ segment }) => segment);
  }
  return fallbackGraphemes(text);
}

function normalizeTiming(timing) {
  const values = { ...DIALOGUE_READER_TIMING, ...timing };
  for (const key of ["textCharactersPerSecond", "fastForwardCharactersPerSecond"]) {
    if (!Number.isFinite(values[key]) || values[key] <= 0) {
      throw new RangeError(key + " must be a positive finite number.");
    }
  }
  if (!Number.isFinite(values.autoDelayMs) || values.autoDelayMs < 0) {
    throw new RangeError("autoDelayMs must be a non-negative finite number.");
  }
  return Object.freeze(values);
}

function normalizeTime(nowMs) {
  if (!Number.isFinite(nowMs)) throw new RangeError("Dialogue time must be finite.");
  return nowMs;
}

function createSessionProgress() {
  const readBeatIds = new Set();
  const completedSequenceIds = new Set();
  return {
    isBeatRead(id) {
      return readBeatIds.has(id);
    },
    isSequenceCompleted(id) {
      return completedSequenceIds.has(id);
    },
    markRead(id) {
      if (readBeatIds.has(id)) return false;
      readBeatIds.add(id);
      return true;
    },
    markCompleted(id) {
      if (completedSequenceIds.has(id)) return false;
      completedSequenceIds.add(id);
      return true;
    },
  };
}

function immutableHistoryBeat(sequenceId, beat, character) {
  return Object.freeze({
    sequenceId,
    beatId: beat.id,
    speaker: character.name,
    text: beat.text,
    expression: beat.expression,
    pose: beat.pose,
    stage: beat.stage,
    background: beat.background,
    artState: beat.artState,
  });
}

export class DialogueSystem {
  constructor(
    sequences = NARRATIVE_SEQUENCES,
    characters = CHARACTERS,
    progressStore = null,
    timing = {},
  ) {
    this.sequences = sequences;
    this.characters = characters;
    this.progress = progressStore ?? createSessionProgress();
    this.timing = normalizeTiming(timing);
    this.history = [];
    this.historyBeatIds = new Set();
    this.autoEnabled = false;
    this.reset();
  }

  sequence(id) {
    const sequence = this.sequences[id];
    if (!sequence) throw new Error("Unknown dialogue sequence: " + id);
    return sequence;
  }

  start(id, nowMs = 0) {
    if (this.phase !== "closed") {
      throw new Error("Cannot start dialogue while the reader is " + this.phase + ".");
    }

    const sequence = this.sequence(id);
    if (sequence.presentation !== "vn") {
      throw new Error("Dialogue sequence is not VN presentation: " + id);
    }
    if (sequence.beats.length === 0) {
      throw new Error("Dialogue sequence has no beats: " + id);
    }

    this.currentId = id;
    this.current = sequence;
    this.index = 0;
    this.phase = "revealing";
    this.completion = null;
    this.fastForwardHeld = false;
    this.backlogOpen = false;
    this.uiHidden = false;
    this.skipConfirmationOpen = false;
    this.activeForeground = true;
    this.lastWallTimeMs = normalizeTime(nowMs);
    this.installBeat();
    return this.snapshot();
  }

  handleCommand(command, nowMs = this.lastWallTimeMs ?? 0) {
    if (!COMMANDS.has(command)) throw new RangeError("Unknown dialogue command: " + command);
    if (this.phase === "closed") return null;

    this.syncClock(normalizeTime(nowMs));

    if (command === "advance" && !this.backlogOpen && !this.skipConfirmationOpen) {
      if (this.phase === "revealing") this.finishReveal();
      else if (this.phase === "awaitingAdvance") this.phase = "transitioning";
    }

    if (
      command === "toggleAuto"
      && this.phase !== "completed"
      && !this.backlogOpen
      && !this.skipConfirmationOpen
    ) {
      this.autoEnabled = !this.autoEnabled;
      this.maybeBeginAutoTransition();
    }

    if (
      command === "fastForwardStart"
      && this.phase !== "completed"
      && !this.backlogOpen
      && !this.skipConfirmationOpen
    ) {
      this.fastForwardHeld = true;
    }

    if (command === "fastForwardEnd") {
      this.fastForwardHeld = false;
    }

    if (
      command === "openBacklog"
      && this.phase !== "completed"
      && !this.skipConfirmationOpen
    ) {
      this.backlogOpen = true;
    }

    if (command === "closeBacklog") {
      this.backlogOpen = false;
    }

    if (
      command === "toggleUi"
      && this.phase !== "completed"
      && !this.backlogOpen
      && !this.skipConfirmationOpen
    ) {
      this.uiHidden = !this.uiHidden;
    }

    if (
      command === "requestSceneSkip"
      && this.phase !== "completed"
      && !this.backlogOpen
    ) {
      this.skipConfirmationOpen = true;
    }

    if (command === "confirmSceneSkip" && this.skipConfirmationOpen) {
      this.skipConfirmationOpen = false;
      this.completeSequence(true);
    }

    if (command === "cancel") {
      if (this.skipConfirmationOpen) this.skipConfirmationOpen = false;
      else if (this.backlogOpen) this.backlogOpen = false;
    }

    return this.snapshot();
  }

  update(nowMs, { activeForeground } = {}) {
    if (this.phase === "closed") return null;
    const transitionWasPending = this.phase === "transitioning";
    this.syncClock(normalizeTime(nowMs));

    if (activeForeground !== undefined) {
      this.activeForeground = Boolean(activeForeground);
    }

    if (
      transitionWasPending
      && this.phase === "transitioning"
      && !this.backlogOpen
      && !this.skipConfirmationOpen
    ) {
      this.installNextBeat();
    }

    return this.snapshot();
  }

  snapshot() {
    if (this.phase === "closed" || !this.current) return null;
    const beat = this.current.beats[this.index];
    const nextBeat = this.current.beats[this.index + 1] ?? null;
    const character = this.characters[beat.speaker];
    if (!character) throw new Error("Unknown dialogue speaker: " + beat.speaker);

    return Object.freeze({
      sequenceId: this.currentId,
      beatId: beat.id,
      speaker: character.name,
      text: beat.text,
      expression: beat.expression,
      pose: beat.pose,
      stage: beat.stage,
      background: beat.background,
      artState: beat.artState,
      nextBackground: nextBeat?.background ?? null,
      nextArtState: nextBeat?.artState ?? null,
      position: this.index + 1,
      total: this.current.beats.length,
      revealedCount: this.revealedCount,
      revealedText: this.graphemes.slice(0, this.revealedCount).join(""),
      phase: this.phase,
      isRead: this.isCurrentBeatRead(),
      autoEnabled: this.autoEnabled,
      fastForwardHeld: this.fastForwardHeld,
      backlogOpen: this.backlogOpen,
      uiHidden: this.uiHidden,
      skipConfirmationOpen: this.skipConfirmationOpen,
      history: Object.freeze([...this.history]),
      completion: this.completion,
    });
  }

  acknowledgeCompletion() {
    if (this.phase !== "completed" || !this.completion) return null;
    const completion = this.completion;
    this.closeCurrent(false);
    return completion;
  }

  reset() {
    this.closeCurrent(true);
    this.history = [];
    this.historyBeatIds = new Set();
    return null;
  }

  view() {
    return this.snapshot();
  }

  advance() {
    if (this.phase === "closed") return null;
    const nowMs = this.lastWallTimeMs ?? 0;
    this.handleCommand("advance", nowMs);
    if (this.phase === "awaitingAdvance") this.handleCommand("advance", nowMs);
    if (this.phase === "transitioning") this.update(nowMs);

    if (this.phase === "completed") {
      const completion = this.acknowledgeCompletion();
      return {
        completed: true,
        completedId: completion.sequenceId,
        skipped: completion.skipped,
        view: null,
      };
    }

    return { completed: false, view: this.snapshot() };
  }

  readInline(id) {
    return this.sequence(id).beats;
  }

  syncClock(nowMs) {
    if (this.lastWallTimeMs === null) {
      this.lastWallTimeMs = nowMs;
      return;
    }

    const elapsedMs = Math.max(0, nowMs - this.lastWallTimeMs);
    this.lastWallTimeMs = Math.max(this.lastWallTimeMs, nowMs);
    if (
      elapsedMs === 0
      || !this.activeForeground
      || this.backlogOpen
      || this.skipConfirmationOpen
      || this.phase === "completed"
      || this.phase === "transitioning"
    ) {
      return;
    }

    if (this.phase === "revealing") {
      const rate = this.fastForwardHeld && this.isCurrentBeatRead()
        ? this.timing.fastForwardCharactersPerSecond
        : this.timing.textCharactersPerSecond;
      this.revealProgress += (elapsedMs * rate) / 1000;
      this.revealedCount = Math.min(this.graphemes.length, Math.floor(this.revealProgress));
      if (this.revealedCount >= this.graphemes.length) this.finishReveal();
      return;
    }

    if (this.phase === "awaitingAdvance") {
      this.awaitingElapsedMs += elapsedMs;
      this.maybeBeginAutoTransition();
    }
  }

  installBeat() {
    const beat = this.current.beats[this.index];
    this.graphemes = segmentGraphemes(beat.text);
    this.revealProgress = 0;
    this.revealedCount = 0;
    this.awaitingElapsedMs = 0;
    this.phase = "revealing";
  }

  finishReveal() {
    if (this.phase !== "revealing") return false;
    this.revealProgress = this.graphemes.length;
    this.revealedCount = this.graphemes.length;
    this.awaitingElapsedMs = 0;
    this.phase = "awaitingAdvance";

    const beat = this.current.beats[this.index];
    this.progress.markRead?.(beat.id);
    if (!this.historyBeatIds.has(beat.id)) {
      const character = this.characters[beat.speaker];
      if (!character) throw new Error("Unknown dialogue speaker: " + beat.speaker);
      this.history.push(immutableHistoryBeat(this.currentId, beat, character));
      this.historyBeatIds.add(beat.id);
    }
    return true;
  }

  maybeBeginAutoTransition() {
    if (
      this.phase === "awaitingAdvance"
      && this.autoEnabled
      && this.activeForeground
      && !this.backlogOpen
      && !this.skipConfirmationOpen
      && this.awaitingElapsedMs >= this.timing.autoDelayMs
    ) {
      this.phase = "transitioning";
    }
  }

  installNextBeat() {
    if (this.phase !== "transitioning") return false;
    if (this.index + 1 >= this.current.beats.length) {
      this.completeSequence(false);
      return true;
    }

    this.index += 1;
    this.installBeat();
    return true;
  }

  completeSequence(skipped) {
    if (this.phase === "completed") return false;
    this.phase = "completed";
    this.fastForwardHeld = false;
    this.backlogOpen = false;
    this.uiHidden = false;
    this.skipConfirmationOpen = false;
    this.progress.markCompleted?.(this.currentId);
    this.completion = Object.freeze({
      sequenceId: this.currentId,
      skipped: Boolean(skipped),
    });
    return true;
  }

  isCurrentBeatRead() {
    const beat = this.current?.beats[this.index];
    return beat ? this.progress.isBeatRead?.(beat.id) === true : false;
  }

  closeCurrent(clearAuto) {
    this.currentId = null;
    this.current = null;
    this.index = 0;
    this.phase = "closed";
    this.completion = null;
    this.graphemes = [];
    this.revealProgress = 0;
    this.revealedCount = 0;
    this.awaitingElapsedMs = 0;
    this.fastForwardHeld = false;
    this.backlogOpen = false;
    this.uiHidden = false;
    this.skipConfirmationOpen = false;
    this.activeForeground = true;
    this.lastWallTimeMs = null;
    if (clearAuto) this.autoEnabled = false;
  }
}
