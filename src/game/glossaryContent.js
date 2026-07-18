function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const GLOSSARY_UNLOCK_NOTIFICATION = deepFreeze({
  id: "glossary.unlocked",
  title: "Glossary Unlocked",
  text: "An ending has been completed. Recovered records are now available from the title screen.",
});

export const GLOSSARY_ENTRIES = deepFreeze({
  "the-witch": {
    id: "the-witch",
    title: "The Witch",
    text: "An ancient magical being who prevented multiple catastrophes before they entered public history. She accepted secrecy, hatred, and personal blame when disclosure would increase the danger. She abducted Elowen to contain the active threat, study its progression, develop ways to identify future practitioners, and kill its root safely.",
  },
  "princess-elowen": {
    id: "princess-elowen",
    title: "Princess Elowen",
    text: "The only known living necromancer. Her remaining human consciousness continued to love the Prince and surfaced in brief, genuine fragments. Those moments could interrupt the corruption but could not reverse it. Her death destroyed the current root of necromancy.",
  },
  necromancy: {
    id: "necromancy",
    title: "Necromancy",
    text: "Forbidden magic that corrupts more than the dead. Continued use erodes identity, emotion, restraint, and coherent purpose until the practitioner becomes the source sustaining it. At Elowen's stage, separation and cure were impossible.",
  },
  "paired-wedding-rings": {
    id: "paired-wedding-rings",
    title: "Paired Wedding Rings",
    text: "Magically joined rings that allow spouses to sense presence, distance, pain, and emotion. Their bond can also carry speech, power, and influence. A ring confirms connection; it cannot confirm which part of a damaged mind is speaking.",
  },
  "ordered-forces": {
    id: "ordered-forces",
    title: "The Witch's Forces",
    text: "Guardians and constructs summoned for containment. They arrived through clean sigils, appeared in stable ranks, and held specific boundaries. Their magic ended with the Witch.",
  },
  "unstable-forces": {
    id: "unstable-forces",
    title: "Elowen's Forces",
    text: "Necromantic creatures formed through unstable impulses. They appeared irregularly, carried a distorted magical signature, and became more common as the Prince descended. The same damaged will that strengthened him also made his path more dangerous.",
  },
  "buried-history": {
    id: "buried-history",
    title: "Buried History",
    text: "Sealed records contain repeated traces of an unnamed intervening figure at the edge of magical disasters. Witnesses preserved contradictory descriptions—captor, destroyer, warden—because they saw what the Witch did, never what her actions prevented.",
  },
});
