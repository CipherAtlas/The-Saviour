function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const BOOKEND_CHARACTERS = deepFreeze({
  prince: { id: "prince", name: "Zephyr" },
  princess: { id: "princess", name: "Elowen" },
});
export const BOOKEND_SEQUENCES = deepFreeze({
  intro: {
    id: "intro",
    kind: "intro",
    beats: [
      {
        id: "intro.01",
        speaker: "prince",
        text: "Elowen is gone. But her ring still answers mine.",
        stage: "left",
        background: "ring-void",
        artState: "prince.determined",
      },
      {
        id: "intro.02",
        speaker: "prince",
        text: "The bond leads below—to the Witch.",
        stage: "left",
        background: "witch-domain-approach",
        artState: "prince.determined",
      },
      {
        id: "intro.03",
        speaker: "prince",
        text: "Then below is where I go.",
        stage: "left",
        background: "witch-domain-approach",
        artState: "prince.determined",
      },
    ],
  },
  "ending.plea": {
    id: "ending.plea",
    kind: "ending",
    beats: [
      {
        id: "ending.plea.01",
        speaker: "princess",
        text: "You killed her for me.",
        stage: "right",
        background: "prison-open-unstable",
        artState: "princess.corrupt-full",
      },
      {
        id: "ending.plea.02",
        speaker: "prince",
        text: "Elowen… what has she done to you?",
        stage: "left",
        background: "containment-heart-broken",
        artState: "prince.alarmed",
      },
      {
        id: "ending.plea.03",
        speaker: "princess",
        text: "Zephyr—please. Before I lose myself. Strike.",
        stage: "right",
        background: "containment-heart-broken",
        artState: "princess.final-plea",
      },
    ],
  },
  "ending.kill": {
    id: "ending.kill",
    kind: "ending",
    beats: [
      {
        id: "ending.kill.01",
        speaker: "princess",
        text: "Thank you.",
        stage: "right",
        background: "prison-collapse-quiet",
        artState: "princess.lucid",
      },
      {
        id: "ending.kill.02",
        speaker: "prince",
        text: "I found you too late.",
        stage: "left",
        background: "prison-collapse-quiet",
        artState: "prince.devastated",
      },
    ],
  },
  "ending.timeout": {
    id: "ending.timeout",
    kind: "ending",
    beats: [
      {
        id: "ending.timeout.01",
        speaker: "princess",
        text: "Too late.",
        stage: "right",
        background: "prison-collapse-violent",
        artState: "princess.corrupt-full",
      },
      {
        id: "ending.timeout.02",
        speaker: "prince",
        text: "The Witch was trying to hold you here.",
        stage: "left",
        background: "prison-collapse-violent",
        artState: "prince.devastated",
      },
      {
        id: "ending.timeout.03",
        speaker: "princess",
        text: "And now there is no one left to try.",
        stage: "right",
        background: "prison-collapse-violent",
        artState: "princess.triumphant",
      },
    ],
  },
});
