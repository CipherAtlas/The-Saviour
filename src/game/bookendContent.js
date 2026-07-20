function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function sequenceBeats(sequenceId, background, entries) {
  return entries.map((entry, index) => ({
    id: `${sequenceId}.${String(index + 1).padStart(2, "0")}`,
    background: entry.background ?? background,
    ...entry,
  }));
}

export const BOOKEND_CHARACTERS = deepFreeze({
  prince: { id: "prince", name: "Zephyr" },
  princess: { id: "princess", name: "Elowen" },
  witch: { id: "witch", name: "The Witch" },
});

export const BOOKEND_SEQUENCES = deepFreeze({
  intro: {
    id: "intro",
    kind: "intro",
    beats: sequenceBeats("intro", "ring-void", [
      {
        speaker: "prince",
        text: "Elowen is gone. But our wedding rings still answer each other.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "prince",
        text: "The bond leads below—to the Witch.",
        stage: "left",
        background: "witch-domain-approach",
        artState: "prince.determined",
      },
      {
        speaker: "prince",
        text: "Then below is where I go.",
        stage: "left",
        background: "witch-domain-approach",
        artState: "prince.determined",
      },
    ]),
  },
  "boss.confrontation": {
    id: "boss.confrontation",
    kind: "boss",
    beats: sequenceBeats("boss.confrontation", "containment-heart", [
      {
        speaker: "witch",
        text: "Put down your weapon and listen. Elowen is not here because I wanted power over your kingdom. She is here because she practiced necromancy.",
        stage: "right",
        artState: "witch.clinical",
      },
      {
        speaker: "prince",
        text: "No. She would never willingly hurt anyone.",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "I did not say that she intended to. I said that she did.",
        stage: "right",
        artState: "witch.clinical",
      },
      {
        speaker: "prince",
        text: "Then let me see her. If she made a mistake, she should not have to face it alone.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "witch",
        text: "This is not punishment, Prince. It is containment. The magic has corrupted her judgment and steadily eroded her control.",
        stage: "right",
        artState: "witch.warning",
      },
      {
        speaker: "prince",
        text: "She called me through our rings. She knew who I was.",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "Yes. She loves you. That has never been in question. The necromancy used the same bond to influence you.",
        stage: "right",
        artState: "witch.clinical",
      },
      {
        speaker: "prince",
        text: "If she can still love me, then some part of her can still be saved.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "witch",
        text: "Some part of her remains. She cannot be cured.",
        stage: "right",
        artState: "witch.clinical",
      },
      {
        speaker: "prince",
        text: "You cannot expect me to accept that without even speaking to her.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "witch",
        text: "I expect your grief to reject evidence. I will not permit that grief to endanger the world.",
        stage: "right",
        artState: "witch.warning",
      },
      {
        speaker: "prince",
        text: "The creatures I fought—were they hers?",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "Some were mine. They were ordered to stop you. The unstable creatures came from the necromancy surrounding Elowen. It drew you closer while attacking anything that approached.",
        stage: "right",
        artState: "witch.clinical",
      },
      {
        speaker: "prince",
        text: "Why would it bring me here and try to kill me?",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "Because corruption does not preserve reason. It magnifies desire until love becomes possession and protection becomes control.",
        stage: "right",
        artState: "witch.clinical",
      },
      {
        speaker: "prince",
        text: "Then she is trapped inside something she cannot control. I will not leave her to face that alone.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "witch",
        text: "Your compassion does you credit. It does not make releasing her safe.",
        stage: "right",
        artState: "witch.acceptance",
      },
      {
        speaker: "prince",
        text: "I do not want to fight you.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "witch",
        text: "Then leave.",
        stage: "right",
        artState: "witch.combat",
      },
      {
        speaker: "prince",
        text: "I cannot.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "witch",
        text: "Neither can I.",
        stage: "right",
        artState: "witch.combat",
      },
    ]),
  },
  "ending.witch-death": {
    id: "ending.witch-death",
    kind: "ending",
    beats: sequenceBeats("ending.witch-death", "containment-heart-broken", [
      {
        speaker: "prince",
        text: "I am sorry. I could not walk away from her.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "witch",
        text: "I have no use for your apology. Listen. My wards are already failing.",
        stage: "right",
        artState: "witch.wounded",
      },
      {
        speaker: "prince",
        text: "I am listening.",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "Elowen began her work because she wanted to preserve a dying mind. One experiment appeared to succeed. She continued even after the magic began changing her.",
        stage: "right",
        artState: "witch.wounded",
      },
      {
        speaker: "prince",
        text: "If there is no cure, why did you keep her alive?",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "Because an ordinary death would not end the corruption. It would release it through every corpse connected to her. I confined Elowen while I searched for a way to destroy them together.",
        stage: "right",
        artState: "witch.wounded",
      },
      {
        speaker: "prince",
        text: "Then what can I do that you could not?",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "Your rings carry more than presence. They carry chosen love and intent between you. If your hand ends her life while that bond remains open, it will hold the necromancy to its source and sever both together.",
        stage: "right",
        artState: "witch.acceptance",
      },
      {
        speaker: "prince",
        text: "If I am the only one who can end this, why did you fight me?",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "witch",
        text: "Because the containment was not ready to fail, and the same ring had compromised your judgment. I could not place the world in hands the corruption was guiding.",
        stage: "right",
        artState: "witch.acceptance",
      },
      {
        speaker: "prince",
        text: "Can Elowen still understand me?",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "witch",
        text: "For brief intervals. If she asks you to kill her, believe her. No one else can make the strike carry your bond.",
        stage: "right",
        artState: "witch.acceptance",
      },
      {
        speaker: "prince",
        text: "I do not know if I can.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "witch",
        text: "Then decide whether your love exists for Elowen's sake or your own.",
        stage: "right",
        artState: "witch.acceptance",
      },
      {
        speaker: "witch",
        text: "My forces will vanish with me. Whatever remains belongs to her necromancy.",
        stage: "right",
        artState: "witch.wounded",
      },
      {
        speaker: "witch",
        text: "Go. Listen to your wife while she can still speak for herself.",
        stage: "right",
        artState: "witch.acceptance",
      },
    ]),
  },
  "ending.plea": {
    id: "ending.plea",
    kind: "ending",
    beats: sequenceBeats("ending.plea", "prison-open-unstable", [
      {
        speaker: "prince",
        text: "Elowen?",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "princess",
        text: "Zephyr. You should not have come—but I am glad I can see you once more.",
        stage: "right",
        artState: "princess.human",
      },
      {
        speaker: "prince",
        text: "I am taking you out of here. Whatever happened, we can face it together.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "princess",
        text: "No. Please listen. Everything the Witch told you is true.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "You were trying to save people.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "I was. Then proving that I could defeat death became more important than the people I claimed to protect.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "Why did you not tell me?",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "Because I thought I could stop before it mattered. By the time I understood what I had become, I could no longer trust my own reasons.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "That does not mean I have to kill you.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "It does. The Witch could not kill me without releasing it. You can. Our bond will hold the necromancy to me when I die.",
        stage: "right",
        artState: "princess.final-plea",
      },
      {
        speaker: "princess",
        text: "I can feel the wards failing. Soon I will not care whether you live. I will not even understand why I should.",
        stage: "right",
        artState: "princess.final-plea",
      },
      {
        speaker: "prince",
        text: "I came all this way to bring you home.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "I know. And I am sorry that my love brought you somewhere neither of us can leave together.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "I am afraid.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "So am I.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "princess",
        text: "Believe me now, Zephyr. Not the ring. Not the hope that brought you here. Me.",
        stage: "right",
        artState: "princess.final-plea",
      },
      {
        speaker: "princess",
        text: "Please. Before I lose the part of myself that can ask.",
        stage: "right",
        artState: "princess.final-plea",
      },
    ]),
  },
  "ending.kill": {
    id: "ending.kill",
    kind: "ending",
    beats: sequenceBeats("ending.kill", "prison-collapse-quiet", [
      {
        speaker: "prince",
        text: "I am sorry.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "Do not be. You listened.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "I wanted more time.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "So did I. Wanting more time is how all of this began.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "I love you.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "I love you too.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "Stay with me.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "I am. Hold my hand.",
        stage: "right",
        artState: "princess.lucid",
      },
      {
        speaker: "prince",
        text: "I am here.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "I know. Thank you.",
        stage: "right",
        artState: "princess.lucid",
      },
    ]),
  },
  "ending.timeout": {
    id: "ending.timeout",
    kind: "ending",
    beats: sequenceBeats("ending.timeout", "prison-collapse-violent", [
      {
        speaker: "princess",
        text: "Too late.",
        stage: "right",
        artState: "princess.corrupt-full",
      },
      {
        speaker: "prince",
        text: "Elowen? No. Look at me.",
        stage: "left",
        artState: "prince.alarmed",
      },
      {
        speaker: "princess",
        text: "She did look at you. She begged. You decided your hope mattered more.",
        stage: "right",
        artState: "princess.corrupt-full",
      },
      {
        speaker: "prince",
        text: "Fight it. Please.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "She already did. You watched her lose.",
        stage: "right",
        artState: "princess.triumphant",
      },
      {
        speaker: "prince",
        text: "I am not leaving you.",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "No. You crossed ten floors to deliver yourself to me.",
        stage: "right",
        artState: "princess.triumphant",
      },
      {
        speaker: "prince",
        text: "I will not let you hurt anyone.",
        stage: "left",
        artState: "prince.determined",
      },
      {
        speaker: "princess",
        text: "You could not even hurt me.",
        stage: "right",
        artState: "princess.triumphant",
      },
    ]),
  },
  "ending.timeout-final": {
    id: "ending.timeout-final",
    kind: "ending",
    beats: sequenceBeats("ending.timeout-final", "prison-collapse-violent", [
      {
        speaker: "prince",
        text: "I am sorry…",
        stage: "left",
        artState: "prince.devastated",
      },
      {
        speaker: "princess",
        text: "You should be. The Witch warned you. Your wife begged you. And you still needed more time.",
        stage: "right",
        artState: "princess.corrupt-full",
      },
      {
        speaker: "princess",
        text: "You wanted us together. Now you will never leave.",
        stage: "right",
        artState: "princess.triumphant",
      },
    ]),
  },
});
