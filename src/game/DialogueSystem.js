import { CHARACTERS, NARRATIVE_SEQUENCES } from "./dialogueContent.js";

function publicBeat(sequenceId, beat, index, total, characters) {
  const character = characters[beat.speaker];
  if (!character) throw new Error(`Unknown dialogue speaker: ${beat.speaker}`);
  return {
    sequenceId,
    beatId: beat.id,
    speaker: character.name,
    portrait: character.portrait,
    text: beat.text,
    position: index + 1,
    total,
  };
}

export class DialogueSystem {
  constructor(sequences = NARRATIVE_SEQUENCES, characters = CHARACTERS) {
    this.sequences = sequences;
    this.characters = characters;
    this.currentId = null;
    this.current = null;
    this.index = 0;
  }

  sequence(id) {
    const sequence = this.sequences[id];
    if (!sequence) throw new Error(`Unknown dialogue sequence: ${id}`);
    return sequence;
  }

  start(id) {
    const sequence = this.sequence(id);
    if (sequence.presentation !== "modal") {
      throw new Error(`Dialogue sequence is not modal: ${id}`);
    }
    if (sequence.beats.length === 0) throw new Error(`Dialogue sequence has no beats: ${id}`);
    this.currentId = id;
    this.current = sequence;
    this.index = 0;
    return this.view();
  }

  view() {
    if (!this.current) return null;
    return publicBeat(
      this.currentId,
      this.current.beats[this.index],
      this.index,
      this.current.beats.length,
      this.characters,
    );
  }

  advance() {
    if (!this.current) return null;
    if (this.index + 1 < this.current.beats.length) {
      this.index += 1;
      return { completed: false, view: this.view() };
    }

    const completedId = this.currentId;
    this.reset();
    return { completed: true, completedId, view: null };
  }

  readInline(id) {
    const sequence = this.sequence(id);
    if (sequence.presentation !== "inline") {
      throw new Error(`Dialogue sequence is not inline: ${id}`);
    }
    return sequence.beats.map((beat, index) => publicBeat(
      id,
      beat,
      index,
      sequence.beats.length,
      this.characters,
    ));
  }

  reset() {
    this.currentId = null;
    this.current = null;
    this.index = 0;
  }
}
