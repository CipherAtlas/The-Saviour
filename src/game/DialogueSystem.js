import { DIALOGUE } from "./dialogueContent.js";

export class DialogueSystem {
  constructor(content = DIALOGUE) {
    this.content = content;
    this.currentId = null;
    this.current = null;
  }

  start(id) {
    const node = this.content[id];
    if (!node) throw new Error(`Unknown dialogue node: ${id}`);
    this.currentId = id;
    this.current = node;
    return this.view();
  }

  view() {
    if (!this.current) return null;
    return {
      id: this.currentId,
      speaker: this.current.speaker,
      portrait: this.current.portrait,
      text: this.current.text,
      choices: this.current.choices.map((choice, index) => ({ index, text: choice.text })),
    };
  }

  choose(index) {
    if (!this.current) throw new Error("No active dialogue");
    const choice = this.current.choices[index];
    if (!choice) throw new Error(`Unknown dialogue choice: ${index}`);
    const result = {
      id: this.currentId,
      response: choice.response,
      effects: choice.effects.map((effect) => ({ ...effect })),
    };
    this.currentId = null;
    this.current = null;
    return result;
  }
}
