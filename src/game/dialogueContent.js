function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const CHARACTERS = deepFreeze({
  prince: {
    id: "prince",
    name: "Prince",
    portrait: null,
  },
  princess: {
    id: "princess-elowen",
    name: "Princess Elowen",
    portrait: "/assets/princess-portrait.webp",
  },
  witch: {
    id: "the-witch",
    name: "The Witch",
    portrait: "/assets/evil-queen-portrait.webp",
  },
});

const PRINCE = "prince";
const PRINCESS = "princess";
const WITCH = "witch";

function sequence(id, presentation, repeat, lines) {
  return deepFreeze({
    id,
    presentation,
    repeat,
    beats: lines.map(([speaker, text], index) => ({
      id: `${id}.b${String(index + 1).padStart(2, "0")}`,
      speaker,
      text,
    })),
  });
}

function assertIntegerInRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
}

export function floorProjectionId(floor) {
  assertIntegerInRange(floor, 1, 10, "Floor");
  return `floor.f${String(floor).padStart(2, "0")}.witch`;
}

export function upgradeSequenceId(floor, room) {
  assertIntegerInRange(floor, 1, 10, "Floor");
  assertIntegerInRange(room, 1, 3, "Room");
  if (floor === 10 && room === 3) throw new RangeError("Floor 10 room 3 is the boss encounter, not an upgrade offer.");
  const suffix = room === 3 ? "threshold" : `r${String(room).padStart(2, "0")}`;
  return `floor.f${String(floor).padStart(2, "0")}.upgrade.${suffix}`;
}

export const FLOOR_PROJECTION_IDS = deepFreeze(
  Array.from({ length: 10 }, (_unused, index) => floorProjectionId(index + 1)),
);

export const UPGRADE_SEQUENCE_IDS = deepFreeze(
  Array.from({ length: 10 }, (_unused, index) => index + 1).flatMap((floor) => {
    const rooms = floor === 10 ? [1, 2] : [1, 2, 3];
    return rooms.map((room) => upgradeSequenceId(floor, room));
  }),
);

const entries = [
  sequence("opening.ring", "modal", "oncePerRun", [
    [PRINCE, "Elowen? Your side of the bed was empty. I followed the pull between our rings here."],
    [PRINCESS, "I'm still here."],
    [PRINCE, "Far below. Afraid... hurt."],
    [PRINCESS, "Please—"],
  ]),
  sequence("opening.threshold", "modal", "oncePerRun", [
    [WITCH, "This threshold remains open behind you. The next will not."],
    [PRINCE, "Where is my wife?"],
    [WITCH, "Beyond your reach."],
    [PRINCE, "Bring her here."],
    [WITCH, "No."],
    [PRINCE, "You took her."],
    [WITCH, "I did."],
    [PRINCE, "Then release her—or I open the way myself."],
    [WITCH, "You do not understand what you are approaching."],
    [PRINCE, "I understand that she is alive and you are keeping her."],
    [WITCH, "That is insufficient."],
  ]),

  sequence(floorProjectionId(1), "modal", "oncePerRun", [
    [WITCH, "Your judgment is compromised. Leave while choice remains."],
    [PRINCE, "You mistake love for weakness."],
    [WITCH, "No. I account for it as exposure."],
  ]),
  sequence(upgradeSequenceId(1, 1), "inline", "perOffer", [
    [PRINCESS, "This place and our love have made a kind of bond. I can lend you some of my strength."],
    [PRINCE, "Then lend me enough to reach you."],
  ]),
  sequence(upgradeSequenceId(1, 2), "inline", "perOffer", [
    [PRINCESS, "Easy. Choose what keeps you standing."],
  ]),
  sequence(upgradeSequenceId(1, 3), "inline", "perOffer", [
    [PRINCESS, "There you are. Breathe before you go on."],
  ]),

  sequence(floorProjectionId(2), "modal", "oncePerRun", [
    [WITCH, "Her release remains an unacceptable outcome."],
    [PRINCE, "Then stop sending your dead."],
    [WITCH, "Not every hostile response below is under my control."],
  ]),
  sequence(upgradeSequenceId(2, 1), "inline", "perOffer", [
    [PRINCESS, "I felt that strike. Are you hurt?"],
    [PRINCE, "Not enough to turn back."],
  ]),
  sequence(upgradeSequenceId(2, 2), "inline", "perOffer", [
    [PRINCESS, "Take what you need. I'll hold the thread between us."],
  ]),
  sequence(upgradeSequenceId(2, 3), "inline", "perOffer", [
    [PRINCESS, "Closer now. I can almost hear you breathe."],
  ]),

  sequence(floorProjectionId(3), "modal", "oncePerRun", [
    [WITCH, "A signal proves contact. It does not prove the sender remains trustworthy."],
    [PRINCE, "You cannot make me doubt her."],
    [WITCH, "Doubt is not required. The exposure remains."],
  ]),
  sequence(upgradeSequenceId(3, 1), "inline", "perOffer", [
    [PRINCESS, "The Witch wants you afraid of me. Don't let her between us."],
    [PRINCE, "She won't."],
  ]),
  sequence(upgradeSequenceId(3, 2), "inline", "perOffer", [
    [PRINCESS, "I can feel the distance closing."],
  ]),
  sequence(upgradeSequenceId(3, 3), "inline", "perOffer", [
    [PRINCESS, "Break her seals and keep descending. Please."],
  ]),

  sequence(floorProjectionId(4), "modal", "oncePerRun", [
    [WITCH, "The responses below are becoming less consistent."],
    [PRINCE, "Call them off."],
    [WITCH, "You continue to misunderstand the word ‘mine.’"],
  ]),
  sequence(upgradeSequenceId(4, 1), "inline", "perOffer", [
    [PRINCESS, "You sound tired. Take this before the next door."],
    [PRINCE, "I sound worse than I am."],
  ]),
  sequence(upgradeSequenceId(4, 2), "inline", "perOffer", [
    [PRINCESS, "Her barriers are thinning. Don't give them time to mend."],
  ]),
  sequence(upgradeSequenceId(4, 3), "inline", "perOffer", [
    [PRINCESS, "Every lock you break brings your hand closer to mine."],
  ]),

  sequence(floorProjectionId(5), "modal", "oncePerRun", [
    [WITCH, "Watch their arrivals. Mine enter in ranks. The others tear their way through."],
    [PRINCE, "Another trick."],
    [WITCH, "Observation requires no trust."],
  ]),
  sequence(upgradeSequenceId(5, 1), "inline", "perOffer", [
    [PRINCESS, "Take more. I don't want the Witch deciding how much of you reaches me."],
  ]),
  sequence(upgradeSequenceId(5, 2), "inline", "perOffer", [
    [PRINCESS, "Stop measuring the cost. Choose what ends the next fight."],
    [PRINCE, "You used to care about the cost."],
  ]),
  sequence(upgradeSequenceId(5, 3), "inline", "perOffer", [
    [PRINCESS, "Come to me before this place takes anything else."],
  ]),

  sequence(floorProjectionId(6), "modal", "oncePerRun", [
    [WITCH, "Her voice has changed."],
    [PRINCE, "You've hurt her."],
    [WITCH, "I know deterioration. Pain is not the same process."],
  ]),
  sequence(upgradeSequenceId(6, 1), "inline", "perOffer", [
    [PRINCESS, "Take it. Strip them to the bone—no. Forgive me. The Witch is twisting what I say."],
    [PRINCE, "I know your voice."],
  ]),
  sequence(upgradeSequenceId(6, 2), "inline", "perOffer", [
    [PRINCESS, "This one is gentler. See? I'm still here."],
  ]),
  sequence(upgradeSequenceId(6, 3), "inline", "perOffer", [
    [PRINCESS, "Rest quickly. I need you moving again."],
  ]),

  sequence(floorProjectionId(7), "modal", "oncePerRun", [
    [WITCH, "The magic strengthening you matches the residue around the unstable dead."],
    [PRINCE, "She would never send them."],
    [WITCH, "That answer assumes she can still choose one purpose."],
  ]),
  sequence(upgradeSequenceId(7, 1), "inline", "perOffer", [
    [PRINCESS, "Take it. The next chamber already knows you're here."],
    [PRINCE, "How could you know that?"],
  ]),
  sequence(upgradeSequenceId(7, 2), "inline", "perOffer", [
    [PRINCESS, "Whatever they raise against you, break it and move."],
  ]),
  sequence(upgradeSequenceId(7, 3), "inline", "perOffer", [
    [PRINCESS, "At the bottom, do not bargain with her. Kill the Witch."],
  ]),

  sequence(floorProjectionId(8), "modal", "oncePerRun", [
    [WITCH, "Her condition is progressive. The intervals of clarity will shorten."],
    [PRINCE, "You don't know her."],
    [WITCH, "I know this does not reverse."],
  ]),
  sequence(upgradeSequenceId(8, 1), "inline", "perOffer", [
    [PRINCESS, "Choose. I need you stronger now."],
  ]),
  sequence(upgradeSequenceId(8, 2), "inline", "perOffer", [
    [PRINCESS, "You belong with me. I—please, don't trust my voice—keep going."],
    [PRINCE, "Elowen, was that you?"],
  ]),
  sequence(upgradeSequenceId(8, 3), "inline", "perOffer", [
    [PRINCESS, "Good. You still know how to obey."],
  ]),

  sequence(floorProjectionId(9), "modal", "oncePerRun", [
    [WITCH, "That is not fear in her voice."],
    [PRINCE, "I heard her warn me not to trust it."],
    [WITCH, "For one breath. Then the thing wearing her affection took it back."],
  ]),
  sequence(upgradeSequenceId(9, 1), "inline", "perOffer", [
    [PRINCESS, "The careful ones are hers. See how neatly they hold their lines?"],
    [PRINCE, "And the others?"],
  ]),
  sequence(upgradeSequenceId(9, 2), "inline", "perOffer", [
    [PRINCESS, "Stop. Please, don't come any closer—come to me. Now."],
  ]),
  sequence(upgradeSequenceId(9, 3), "inline", "perOffer", [
    [PRINCESS, "Hurry. I can feel every breath you waste."],
  ]),

  sequence(floorProjectionId(10), "modal", "oncePerRun", [
    [WITCH, "She guided you. Strengthened you. Hunted you."],
    [PRINCE, "You hunted me."],
    [WITCH, "Not alone."],
    [WITCH, "Kill me, and you will see what you have freed."],
  ]),
  sequence(upgradeSequenceId(10, 1), "inline", "perOffer", [
    [PRINCESS, "You're bleeding again. How inconvenient. Choose."],
    [PRINCE, "Inconvenient?"],
  ]),
  sequence(upgradeSequenceId(10, 2), "inline", "perOffer", [
    [PRINCESS, "Give me the Witch's last breath, love. I'll give you—please. Hurry."],
  ]),

  sequence("boss.confrontation", "modal", "oncePerRun", [
    [WITCH, "You have mistaken the keeper for the prison."],
    [PRINCE, "Release her."],
    [WITCH, "The ring has made your judgment unusable."],
    [PRINCE, "I am done listening."],
    [WITCH, "Kill the keeper, and the prison opens. She is not waiting to be saved."],
    [PRINCE, "Then she can tell me herself."],
  ]),
  sequence("ending.witch-death", "modal", "oncePerRun", [
    [PRINCE, "It's over."],
    [WITCH, "Yes. My part."],
    [WITCH, "When the ordered lights fail, watch what remains."],
  ]),
  sequence("ending.princess-reveal", "modal", "oncePerRun", [
    [PRINCESS, "You did it. Every pull through the ring, and you followed."],
    [PRINCE, "Elowen...?"],
    [PRINCESS, "You made love so easy to steer."],
    [PRINCE, "What did she do to you?"],
  ]),
  sequence("ending.princess-human", "modal", "oncePerRun", [
    [PRINCESS, "Not this. Listen—before it takes my voice again."],
    [PRINCE, "What was speaking through the ring?"],
    [PRINCESS, "It was necromancy. Mine. She was containing me. There is no cure—kill me. Now."],
  ]),
  sequence("ending.kill", "modal", "oncePerRun", [
    [PRINCE, "Forgive me."],
    [PRINCESS, "No. This was still my choice."],
    [PRINCE, "I love you."],
    [PRINCESS, "I know."],
    [PRINCESS, "Thank you."],
    [PRINCE, "I found you."],
  ]),
  sequence("ending.timeout", "modal", "oncePerRun", [
    [PRINCESS, "You heard me clearly. You simply wanted another answer."],
    [PRINCE, "The ring—you pulled me here."],
    [PRINCESS, "And you named every pull love."],
  ]),
  sequence("ending.timeout-final", "modal", "oncePerRun", [
    [PRINCE, "The Witch was keeping you here."],
    [PRINCESS, "Until you made certain there was nothing between us."],
    [PRINCESS, "Nothing at all."],
  ]),
];

export const NARRATIVE_SEQUENCES = deepFreeze(
  Object.fromEntries(entries.map((entry) => [entry.id, entry])),
);
