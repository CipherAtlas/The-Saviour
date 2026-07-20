import { BOOKEND_CHARACTERS, BOOKEND_SEQUENCES } from "./bookendContent.js";

export class BookendSequence {
  constructor(sequences = BOOKEND_SEQUENCES, characters = BOOKEND_CHARACTERS) {
    this.sequences = sequences;
    this.characters = characters;
    this.reset();
  }

  sequence(id) {
    const sequence = this.sequences[id];
    if (!sequence) throw new RangeError(`Unknown bookend sequence: ${id}`);
    return sequence;
  }

  start(id) {
    if (this.current) throw new Error("Cannot start a bookend while another is active.");
    this.current = this.sequence(id);
    this.index = 0;
    return this.snapshot();
  }

  advance() {
    if (!this.current) return Object.freeze({ completed: false, view: null });
    if (this.index + 1 < this.current.beats.length) {
      this.index += 1;
      return Object.freeze({ completed: false, view: this.snapshot() });
    }
    const sequenceId = this.current.id;
    this.reset();
    return Object.freeze({ completed: true, sequenceId, view: null });
  }

  snapshot() {
    if (!this.current) return null;
    const beat = this.current.beats[this.index];
    const character = this.characters[beat.speaker];
    if (!character) throw new RangeError(`Unknown bookend speaker: ${beat.speaker}`);
    const nextBeat = this.current.beats[this.index + 1] ?? null;
    return Object.freeze({
      sequenceId: this.current.id,
      kind: this.current.kind,
      beatId: beat.id,
      speaker: character.name,
      text: beat.text,
      revealedText: beat.text,
      stage: beat.stage,
      background: beat.background,
      artState: beat.artState,
      nextBackground: nextBeat?.background ?? null,
      nextArtState: nextBeat?.artState ?? null,
      position: this.index + 1,
      total: this.current.beats.length,
    });
  }

  reset() {
    this.current = null;
    this.index = 0;
  }
}
