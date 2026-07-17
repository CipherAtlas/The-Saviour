export const DIALOGUE = Object.freeze({
  intro: Object.freeze({
    speaker: "Princess Elowen",
    portrait: "/assets/princess-portrait.webp",
    text: "Knight... if this reaches you, the Hollow Queen has not yet sealed every road between our realms. Her dungeons feed on fear. Do not let them learn yours.",
    choices: Object.freeze([
      Object.freeze({
        text: "Tell me where she has taken you.",
        response: "Beyond nine thresholds. I will leave a light wherever her darkness thins.",
        effects: Object.freeze([{ type: "setFlag", key: "focusedRescue", value: true }, { type: "damage", amount: 0.06 }]),
      }),
      Object.freeze({
        text: "Hold fast. I am coming for you.",
        response: "Then I will hold. Take this fragment of strength before the passage closes.",
        effects: Object.freeze([{ type: "setFlag", key: "promisedReturn", value: true }, { type: "healMax", amount: 12 }]),
      }),
    ]),
  }),
  fallenKnight: Object.freeze({
    speaker: "A Fallen Knight",
    portrait: null,
    text: "I reached the fourth descent and called my fury courage. The Queen knew the difference. Will you carry what remains of me—or grant me silence?",
    choices: Object.freeze([
      Object.freeze({
        text: "Rest. Your watch is ended.",
        response: "Mercy, here? Perhaps she has not taken everything from us.",
        effects: Object.freeze([{ type: "setFlag", key: "showedMercy", value: true }, { type: "heal", amount: 32 }]),
      }),
      Object.freeze({
        text: "Lend me your rage. I will finish this.",
        response: "Then spend it better than I did.",
        effects: Object.freeze([{ type: "setFlag", key: "claimedRage", value: true }, { type: "damage", amount: 0.12 }]),
      }),
    ]),
  }),
  princessVision: Object.freeze({
    speaker: "Princess Elowen",
    portrait: "/assets/princess-portrait.webp",
    text: "She says your kingdom will praise the rescue and forget its cost. I fear she knows our court better than I do.",
    choices: Object.freeze([
      Object.freeze({
        text: "I did not come for praise.",
        response: "Good. Then whatever waits at the end will meet the knight I trusted.",
        effects: Object.freeze([{ type: "setFlag", key: "selfless", value: true }, { type: "critical", amount: 0.08 }]),
      }),
      Object.freeze({
        text: "We will decide the cost when you are free.",
        response: "Practical as ever. Survive first, argue later.",
        effects: Object.freeze([{ type: "setFlag", key: "pragmatic", value: true }, { type: "dashRecovery", amount: 0.12 }]),
      }),
    ]),
  }),
  queenConfrontation: Object.freeze({
    speaker: "The Hollow Queen",
    portrait: "/assets/evil-queen-portrait.webp",
    text: "Ten vaults broken for one gilded heir. Tell me, reaper—do you love her, or merely the song they will sing when you return?",
    choices: Object.freeze([
      Object.freeze({
        text: "Release her, and I may let your realm keep its queen.",
        response: "Mercy spoken with a blade in hand. How very mortal.",
        effects: Object.freeze([{ type: "setFlag", key: "offeredMercy", value: true }, { type: "bossHealth", amount: -0.08 }]),
      }),
      Object.freeze({
        text: "Your realm ends here.",
        response: "Then let it end loudly.",
        effects: Object.freeze([{ type: "setFlag", key: "defiant", value: true }, { type: "damage", amount: 0.1 }, { type: "bossEnrage", amount: 0.1 }]),
      }),
      Object.freeze({
        text: "Why take her at all?",
        response: "Because her blood opens the gate your kings sealed—and because your arrival proves they were right to fear it.",
        effects: Object.freeze([{ type: "setFlag", key: "knowsTruth", value: true }, { type: "heal", amount: 28 }]),
      }),
    ]),
  }),
  ending: Object.freeze({
    speaker: "Princess Elowen",
    portrait: "/assets/princess-portrait.webp",
    text: "The gate is collapsing, but something must anchor it from our side. We can return now—or seal the Hollow Realm so no queen can cross again.",
    choices: Object.freeze([
      Object.freeze({
        text: "We return together. Our realm needs the truth.",
        response: "Then together. Let the court hear what its old war left buried.",
        effects: Object.freeze([{ type: "ending", value: "homecoming" }]),
      }),
      Object.freeze({
        text: "Seal it. No one else should walk these halls.",
        response: "A kingdom saved, a road erased. They will never know how close the darkness came.",
        effects: Object.freeze([{ type: "ending", value: "sealed" }]),
      }),
      Object.freeze({
        text: "Keep the gate—but we guard it together.",
        response: "Then the Hollow Realm will learn a different kind of crown.",
        effects: Object.freeze([{ type: "ending", value: "wardens" }]),
      }),
    ]),
  }),
});

