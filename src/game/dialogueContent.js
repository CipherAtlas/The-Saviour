import { characterArtAsset, narrativeBackgroundAsset } from "./narrativeAssetManifest.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

export const CHARACTERS = deepFreeze({
  prince: {
    id: "prince",
    name: "Zephyr",
    defaultStage: "left",
    allowedStages: ["left", "center-left", "center"],
  },
  princess: {
    id: "princess-elowen",
    name: "Princess Elowen",
    defaultStage: "right",
    allowedStages: ["right", "center"],
  },
  witch: {
    id: "the-witch",
    name: "The Witch",
    defaultStage: "right",
    allowedStages: ["right"],
  },
});

function assertIntegerInRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(label + " must be an integer from " + minimum + " to " + maximum + ".");
  }
}

export function floorProjectionId(floor) {
  assertIntegerInRange(floor, 1, 10, "Floor");
  return "floor.f" + String(floor).padStart(2, "0") + ".witch";
}

export function upgradeSequenceId(floor, room) {
  assertIntegerInRange(floor, 1, 10, "Floor");
  assertIntegerInRange(room, 1, 3, "Room");
  if (floor === 10 && room === 3) throw new RangeError("Floor 10 room 3 is the boss encounter, not an upgrade offer.");
  const suffix = room === 3 ? "threshold" : "r" + String(room).padStart(2, "0");
  return "floor.f" + String(floor).padStart(2, "0") + ".upgrade." + suffix;
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
  {
    "id": "opening.domestic",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "domestic",
    "beats": [
      {
        "id": "opening.domestic.b01",
        "speaker": "prince",
        "text": "The west corridor is dark, the supper tray is cold, and my wife is hiding from sleep behind a tower of books. A remarkable mystery.",
        "expression": "fond",
        "pose": "doorway-relaxed",
        "stage": "left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      },
      {
        "id": "opening.domestic.b02",
        "speaker": "princess",
        "text": "Hiding suggests I expect sleep to search intelligently. It has never shown that kind of initiative.",
        "expression": "absorbed",
        "pose": "seated-repairing-book",
        "stage": "right",
        "background": "royal-study-evening",
        "artState": "princess.human"
      },
      {
        "id": "opening.domestic.b03",
        "speaker": "prince",
        "text": "You said one page. That was before the second lamp burned down.",
        "expression": "amused",
        "pose": "crossing-arms",
        "stage": "left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      },
      {
        "id": "opening.domestic.b04",
        "speaker": "princess",
        "text": "It was one page when I said it. Then the binding confessed to several related crimes.",
        "expression": "wry",
        "pose": "showing-torn-page",
        "stage": "right",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b05",
        "speaker": "prince",
        "text": "Give it to the bindery tomorrow. They have glue, thread, and the useful habit of going home at night.",
        "expression": "affectionate",
        "pose": "leaning-over-chair",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      },
      {
        "id": "opening.domestic.b06",
        "speaker": "princess",
        "text": "This belonged to Mara's mother. The child remembers the pressed flowers, not the words. If I replace the page, she keeps both.",
        "expression": "gentle",
        "pose": "shielding-book",
        "stage": "right",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b07",
        "speaker": "prince",
        "text": "You cannot personally rescue every broken thing in the palace.",
        "expression": "soft",
        "pose": "touching-book-edge",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      },
      {
        "id": "opening.domestic.b08",
        "speaker": "princess",
        "text": "No. But “broken” is too often what people call something before they stop trying.",
        "expression": "distant",
        "pose": "looking-at-page",
        "stage": "right",
        "background": "royal-study-evening",
        "artState": "princess.human"
      },
      {
        "id": "opening.domestic.b09",
        "speaker": "prince",
        "text": "That sounded less like a book and more like an argument you have not invited me to.",
        "expression": "watchful",
        "pose": "straightening",
        "stage": "left",
        "background": "royal-study-evening",
        "artState": "prince.alarmed"
      },
      {
        "id": "opening.domestic.b10",
        "speaker": "princess",
        "text": "I invited you to supper. You arrived after the potatoes surrendered. Let us finish one dispute at a time.",
        "expression": "brightening",
        "pose": "closing-book",
        "stage": "right",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b11",
        "speaker": "prince",
        "text": "The potatoes had poor discipline. I accept no responsibility. Come to bed.",
        "expression": "dry",
        "pose": "offering-hand",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.calm"
      },
      {
        "id": "opening.domestic.b12",
        "speaker": "princess",
        "text": "In a moment. Your ring is warm again. You were worrying at it during council.",
        "expression": "tender",
        "pose": "taking-hand",
        "stage": "center",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b13",
        "speaker": "prince",
        "text": "It pulls when you shut me out. Very dignified magic for a royal marriage.",
        "expression": "embarrassed",
        "pose": "turning-ring",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.calm"
      },
      {
        "id": "opening.domestic.b14",
        "speaker": "princess",
        "text": "It carries presence, not accusations. The accusations are entirely your craftsmanship.",
        "expression": "affectionate",
        "pose": "touching-rings",
        "stage": "center",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b15",
        "speaker": "prince",
        "text": "Two taps means come home. We agreed.",
        "expression": "fond",
        "pose": "tapping-ring-twice",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      },
      {
        "id": "opening.domestic.b16",
        "speaker": "princess",
        "text": "We agreed it means I am here. Home is a larger promise.",
        "expression": "strained",
        "pose": "holding-his-hand",
        "stage": "center",
        "background": "royal-study-evening",
        "artState": "princess.human"
      },
      {
        "id": "opening.domestic.b17",
        "speaker": "prince",
        "text": "Elowen. What have you taken on?",
        "expression": "concerned",
        "pose": "searching-her-face",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.alarmed"
      },
      {
        "id": "opening.domestic.b18",
        "speaker": "princess",
        "text": "A torn book, a defeated supper, and a husband who believes questions become lighter if he asks them standing up. Sit with me.",
        "expression": "evasive-warm",
        "pose": "resting-forehead-to-hand",
        "stage": "center",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b19",
        "speaker": "prince",
        "text": "Until the lamp goes out. Then I carry you upstairs and scandalize the night guard.",
        "expression": "affectionate",
        "pose": "sitting-beside",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      },
      {
        "id": "opening.domestic.b20",
        "speaker": "princess",
        "text": "Let him be scandalized. Just stay until I close this page.",
        "expression": "relieved",
        "pose": "leaning-against-him",
        "stage": "center",
        "background": "royal-study-evening",
        "artState": "princess.affectionate"
      },
      {
        "id": "opening.domestic.b21",
        "speaker": "prince",
        "text": "I can do that. But if dawn finds us here, I am blaming the book in the official record.",
        "expression": "content",
        "pose": "arm-around-her",
        "stage": "center-left",
        "background": "royal-study-evening",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "opening.ring",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "ringPursuit",
    "beats": [
      {
        "id": "opening.ring.b01",
        "speaker": "prince",
        "text": "Elowen? Your side is cold.",
        "expression": "waking-alarmed",
        "pose": "reaching-across-bed",
        "stage": "left",
        "background": "royal-chamber-dawn",
        "artState": "prince.alarmed"
      },
      {
        "id": "opening.ring.b02",
        "speaker": "prince",
        "text": "No cloak. No note. The study door open, the book still under the lamp. You never leave a page unfinished.",
        "expression": "searching",
        "pose": "holding-folded-blanket",
        "stage": "center-left",
        "background": "royal-chamber-dawn",
        "artState": "prince.alarmed"
      },
      {
        "id": "opening.ring.b03",
        "speaker": "prince",
        "text": "Two taps. Come home.",
        "expression": "focused",
        "pose": "tapping-ring-twice",
        "stage": "center",
        "background": "royal-chamber-dawn",
        "artState": "prince.determined"
      },
      {
        "id": "opening.ring.b04",
        "speaker": "princess",
        "text": "Zephyr—",
        "expression": "frightened",
        "pose": "distant-cutout",
        "stage": "right",
        "background": "ring-void",
        "artState": "princess.frightened"
      },
      {
        "id": "opening.ring.b05",
        "speaker": "prince",
        "text": "I hear you. Hold the thread. Tell me where.",
        "expression": "shocked",
        "pose": "braced",
        "stage": "center-left",
        "background": "ring-void",
        "artState": "prince.alarmed"
      },
      {
        "id": "opening.ring.b06",
        "speaker": "princess",
        "text": "Below. So far below. She—please—",
        "expression": "pained",
        "pose": "reaching-through-dark",
        "stage": "right",
        "background": "ring-void",
        "artState": "princess.frightened"
      },
      {
        "id": "opening.ring.b07",
        "speaker": "prince",
        "text": "Who has you? Elowen, answer me.",
        "expression": "urgent",
        "pose": "hand-to-ring",
        "stage": "center-left",
        "background": "ring-void",
        "artState": "prince.alarmed"
      },
      {
        "id": "opening.ring.b08",
        "speaker": "princess",
        "text": "Follow.",
        "expression": "fading",
        "pose": "hand-lowering",
        "stage": "right",
        "background": "ring-void",
        "artState": "princess.frightened"
      },
      {
        "id": "opening.ring.b09",
        "speaker": "prince",
        "text": "The pull runs north beneath the old road. Every step away tightens it. You are alive. That is enough to begin.",
        "expression": "determined",
        "pose": "fastening-armor",
        "stage": "left",
        "background": "royal-armory-morning",
        "artState": "prince.determined"
      },
      {
        "id": "opening.ring.b10",
        "speaker": "prince",
        "text": "Whoever took you left me a path. I will make them regret the courtesy.",
        "expression": "grim",
        "pose": "mounting-scythe",
        "stage": "center",
        "background": "witch-domain-approach",
        "artState": "prince.determined"
      },
      {
        "id": "opening.ring.b11",
        "speaker": "prince",
        "text": "Two taps, Elowen. I am coming home by the road you left me, and I am bringing you with me.",
        "expression": "tender-resolved",
        "pose": "tapping-ring-twice",
        "stage": "center",
        "background": "witch-domain-approach",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "opening.threshold",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "threshold",
    "beats": [
      {
        "id": "opening.threshold.b01",
        "speaker": "witch",
        "text": "The road remains open behind you. The threshold ahead will not offer the same courtesy.",
        "expression": "clinical",
        "pose": "projection-still",
        "stage": "right",
        "background": "dungeon-threshold",
        "artState": "witch.clinical"
      },
      {
        "id": "opening.threshold.b02",
        "speaker": "prince",
        "text": "Where is my wife?",
        "expression": "determined",
        "pose": "scythe-lowered",
        "stage": "left",
        "background": "dungeon-threshold",
        "artState": "prince.determined"
      },
      {
        "id": "opening.threshold.b03",
        "speaker": "witch",
        "text": "Contained beyond your reach. Leave while distance can still protect your judgment.",
        "expression": "unreadable",
        "pose": "hands-folded",
        "stage": "right",
        "background": "dungeon-threshold",
        "artState": "witch.clinical"
      },
      {
        "id": "opening.threshold.b04",
        "speaker": "prince",
        "text": "You took her from our rooms. Release her.",
        "expression": "angry-contained",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "dungeon-threshold",
        "artState": "prince.enraged"
      },
      {
        "id": "opening.threshold.b05",
        "speaker": "witch",
        "text": "I took her. I will not release her.",
        "expression": "clinical",
        "pose": "projection-still",
        "stage": "right",
        "background": "dungeon-threshold",
        "artState": "witch.clinical"
      },
      {
        "id": "opening.threshold.b06",
        "speaker": "prince",
        "text": "Then I open the way myself.",
        "expression": "resolute",
        "pose": "gripping-scythe",
        "stage": "left",
        "background": "dungeon-threshold",
        "artState": "prince.resolved"
      },
      {
        "id": "opening.threshold.b07",
        "speaker": "witch",
        "text": "You have contact, fear, and a direction. You have mistaken that collection for understanding.",
        "expression": "warning",
        "pose": "one-hand-raised",
        "stage": "right",
        "background": "dungeon-threshold",
        "artState": "witch.warning"
      },
      {
        "id": "opening.threshold.b08",
        "speaker": "prince",
        "text": "I have her voice. I felt her pain.",
        "expression": "wounded",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "dungeon-threshold",
        "artState": "prince.injured"
      },
      {
        "id": "opening.threshold.b09",
        "speaker": "witch",
        "text": "Contact is not consent. Pain is not instruction. Turn back.",
        "expression": "severe",
        "pose": "lowering-hand",
        "stage": "right",
        "background": "dungeon-threshold",
        "artState": "witch.warning"
      },
      {
        "id": "opening.threshold.b10",
        "speaker": "prince",
        "text": "She is alive. You are keeping her. I am coming through.",
        "expression": "absolute",
        "pose": "scythe-ready",
        "stage": "left",
        "background": "dungeon-threshold",
        "artState": "prince.resolved"
      },
      {
        "id": "opening.threshold.b11",
        "speaker": "witch",
        "text": "Then observe what resists you. It may be the last honest counsel you accept.",
        "expression": "resigned",
        "pose": "projection-fading",
        "stage": "right",
        "background": "dungeon-threshold",
        "artState": "witch.acceptance"
      },
      {
        "id": "opening.threshold.b12",
        "speaker": "prince",
        "text": "Counsel begins with a reason. You gave me a threat and expected obedience.",
        "expression": "cold",
        "pose": "entering-threshold",
        "stage": "left",
        "background": "dungeon-threshold",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f01.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f01.witch.b01",
        "speaker": "witch",
        "text": "Your pulse rises when the ring warms. Your grip tightens before her voice finishes. That is exposure, not resolve.",
        "expression": "clinical",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-crypt-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f01.witch.b02",
        "speaker": "prince",
        "text": "You mistake devotion for a weakness you can measure.",
        "expression": "dismissive",
        "pose": "scythe-shouldered",
        "stage": "left",
        "background": "biome-crypt-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f01.witch.b03",
        "speaker": "witch",
        "text": "I measure its effect. You surrender judgment to anything that sounds like hope.",
        "expression": "precise",
        "pose": "hands-folded",
        "stage": "right",
        "background": "biome-crypt-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f01.witch.b04",
        "speaker": "prince",
        "text": "Then stop talking and watch me reach her.",
        "expression": "determined",
        "pose": "turning-away",
        "stage": "left",
        "background": "biome-crypt-graded",
        "artState": "prince.determined"
      },
      {
        "id": "floor.f01.witch.b05",
        "speaker": "witch",
        "text": "I will watch. Observation is the one service you cannot refuse from me.",
        "expression": "unreadable",
        "pose": "projection-fading",
        "stage": "right",
        "background": "biome-crypt-graded",
        "artState": "witch.clinical"
      }
    ]
  },
  {
    "id": "floor.f01.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f01.upgrade.r01.b01",
        "speaker": "princess",
        "text": "Zephyr. There you are. I could feel you at the threshold, but not whether you crossed it standing.",
        "expression": "relieved",
        "pose": "reaching-forward",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.r01.b02",
        "speaker": "prince",
        "text": "I am standing. Tell me how you reached me.",
        "expression": "relieved-contained",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "biome-crypt-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f01.upgrade.r01.b03",
        "speaker": "princess",
        "text": "This place presses on the bond between our rings. Our love gives it shape. I can send a little strength back along the thread.",
        "expression": "gentle",
        "pose": "touching-ring",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.r01.b04",
        "speaker": "prince",
        "text": "Will it hurt you?",
        "expression": "focused",
        "pose": "offering-ring-hand",
        "stage": "left",
        "background": "biome-crypt-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f01.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Less than hearing you fight empty-handed. Choose what keeps you moving, and let me carry one part of the weight.",
        "expression": "reassuring",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.human"
      },
      {
        "id": "floor.f01.upgrade.r01.b06",
        "speaker": "prince",
        "text": "Only one part. I am still coming for the rest.",
        "expression": "tender",
        "pose": "slight-nod",
        "stage": "left",
        "background": "biome-crypt-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f01.upgrade.r01.b07",
        "speaker": "princess",
        "text": "I know. That certainty used to frighten ministers. Today it is the sound I needed.",
        "expression": "affectionate",
        "pose": "palm-over-heart",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.affectionate"
      }
    ]
  },
  {
    "id": "floor.f01.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f01.upgrade.r02.b01",
        "speaker": "princess",
        "text": "Your left shoulder drops when you are hurt. It has since the winter tournament.",
        "expression": "concerned",
        "pose": "studying-him",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f01.upgrade.r02.b02",
        "speaker": "prince",
        "text": "An excellent marriage. Even captivity has not spared me observation.",
        "expression": "dry",
        "pose": "rolling-shoulder",
        "stage": "left",
        "background": "biome-crypt-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f01.upgrade.r02.b03",
        "speaker": "princess",
        "text": "Captivity has improved my view of your bad habits. Take something that lets the shoulder rest.",
        "expression": "fond",
        "pose": "almost-smiling",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.r02.b04",
        "speaker": "prince",
        "text": "Then I will weigh rest against ending the next fight sooner. A compromise.",
        "expression": "affectionate",
        "pose": "adjusting-grip",
        "stage": "left",
        "background": "biome-crypt-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f01.upgrade.r02.b05",
        "speaker": "princess",
        "text": "A familiar word from you, used incorrectly as ever. Still—choose.",
        "expression": "warm",
        "pose": "nodding",
        "stage": "right",
        "background": "biome-crypt-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.r02.b06",
        "speaker": "prince",
        "text": "If the choice works, history will forgive my definition. It has endured worse from our court.",
        "expression": "fond",
        "pose": "reaching-to-offer",
        "stage": "left",
        "background": "biome-crypt-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f01.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f01.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "You are breathing through your teeth. Stop before the next stair.",
        "expression": "gentle",
        "pose": "listening",
        "stage": "right",
        "background": "crypt-threshold-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "If I stop, the distance notices.",
        "expression": "tired",
        "pose": "scythe-grounded",
        "stage": "left",
        "background": "crypt-threshold-soft",
        "artState": "prince.injured"
      },
      {
        "id": "floor.f01.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "The distance has no authority here. Remember the study? You stayed until I closed the page. Let me stay while you catch your breath.",
        "expression": "affectionate",
        "pose": "seated-memory",
        "stage": "right",
        "background": "crypt-threshold-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "The lamp went out first. You claimed that counted.",
        "expression": "softened",
        "pose": "sitting",
        "stage": "left",
        "background": "crypt-threshold-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f01.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "I was right. I am also right now. Breathe, choose, then come closer.",
        "expression": "wry",
        "pose": "hand-to-ring",
        "stage": "right",
        "background": "crypt-threshold-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f01.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "Better. Keep the memory warm. I will need it when the next room tries to sound like the last.",
        "expression": "steadied",
        "pose": "rising",
        "stage": "left",
        "background": "crypt-threshold-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f02.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f02.witch.b01",
        "speaker": "witch",
        "text": "Her release remains an unacceptable outcome. Your presence has also produced responses below that I did not order.",
        "expression": "clinical",
        "pose": "projection-observing",
        "stage": "right",
        "background": "biome-catacomb-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f02.witch.b02",
        "speaker": "prince",
        "text": "Your dead claw at me, and you call them an observation.",
        "expression": "accusatory",
        "pose": "scythe-forward",
        "stage": "left",
        "background": "biome-catacomb-graded",
        "artState": "prince.enraged"
      },
      {
        "id": "floor.f02.witch.b03",
        "speaker": "witch",
        "text": "Some arrive in formation. Others arrive as if formation itself offended them. I advise you to notice the difference.",
        "expression": "precise",
        "pose": "indicating-arena",
        "stage": "right",
        "background": "biome-catacomb-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f02.witch.b04",
        "speaker": "prince",
        "text": "I notice every path leads through you.",
        "expression": "dismissive",
        "pose": "turning-away",
        "stage": "left",
        "background": "biome-catacomb-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f02.witch.b05",
        "speaker": "witch",
        "text": "A path can cross a keeper without originating from her. That distinction will matter whether you accept it or not.",
        "expression": "restrained",
        "pose": "projection-fading",
        "stage": "right",
        "background": "biome-catacomb-graded",
        "artState": "witch.clinical"
      }
    ]
  },
  {
    "id": "floor.f02.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f02.upgrade.r01.b01",
        "speaker": "princess",
        "text": "That last blow reached me through the ring. Not the pain exactly—the shock after it.",
        "expression": "worried",
        "pose": "hand-to-chest",
        "stage": "right",
        "background": "biome-catacomb-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f02.upgrade.r01.b02",
        "speaker": "prince",
        "text": "A shallow cut. It looks dramatic because armor enjoys gossip.",
        "expression": "reassuring",
        "pose": "checking-wound",
        "stage": "left",
        "background": "biome-catacomb-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f02.upgrade.r01.b03",
        "speaker": "princess",
        "text": "Your armor learned from you. Choose defense this time. Humor me.",
        "expression": "restrained-amusement",
        "pose": "exhaling",
        "stage": "right",
        "background": "biome-catacomb-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f02.upgrade.r01.b04",
        "speaker": "prince",
        "text": "I will consider defense among the available ways to end danger.",
        "expression": "fond",
        "pose": "open-hand",
        "stage": "left",
        "background": "biome-catacomb-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f02.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Consider quickly, stubborn man. I would like all of you to arrive.",
        "expression": "tender",
        "pose": "touching-ring",
        "stage": "right",
        "background": "biome-catacomb-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f02.upgrade.r01.b06",
        "speaker": "prince",
        "text": "Then all of me will. The shoulder, the armor, and the bad judgment you insist belongs to both.",
        "expression": "reassuring",
        "pose": "securing-armor",
        "stage": "left",
        "background": "biome-catacomb-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f02.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f02.upgrade.r02.b01",
        "speaker": "princess",
        "text": "The thread steadies when you are still. I can hold it while you decide.",
        "expression": "calm",
        "pose": "holding-ring-hand",
        "stage": "right",
        "background": "biome-catacomb-soft",
        "artState": "princess.human"
      },
      {
        "id": "floor.f02.upgrade.r02.b02",
        "speaker": "prince",
        "text": "I thought I was holding it for you.",
        "expression": "watchful",
        "pose": "lowering-scythe",
        "stage": "left",
        "background": "biome-catacomb-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f02.upgrade.r02.b03",
        "speaker": "princess",
        "text": "Both can be true. That was the point of the rings, unless you slept through the vows.",
        "expression": "warm",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-catacomb-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f02.upgrade.r02.b04",
        "speaker": "prince",
        "text": "I remember correcting the officiant's map of the eastern marches.",
        "expression": "dry",
        "pose": "slight-smile",
        "stage": "left",
        "background": "biome-catacomb-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f02.upgrade.r02.b05",
        "speaker": "princess",
        "text": "During the vows. Yes. I married you despite compelling evidence. Choose.",
        "expression": "amused",
        "pose": "head-tilt",
        "stage": "right",
        "background": "biome-catacomb-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f02.upgrade.r02.b06",
        "speaker": "prince",
        "text": "And I married the only witness willing to correct me before the ceremony ended. Hold the thread.",
        "expression": "affectionate",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-catacomb-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f02.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f02.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "Closer. I can hear the catch between your breaths now, just before you pretend you are not tired.",
        "expression": "intent",
        "pose": "eyes-closed-listening",
        "stage": "right",
        "background": "catacomb-threshold-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f02.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "You could never hear that across a room.",
        "expression": "surprised",
        "pose": "glancing-around",
        "stage": "left",
        "background": "catacomb-threshold-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f02.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "The bond is sharper here. Everything is. I would trade the clarity for one ordinary room.",
        "expression": "gentle",
        "pose": "touching-ring",
        "stage": "right",
        "background": "catacomb-threshold-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f02.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "Keep listening. I will give you a door instead.",
        "expression": "softened",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "catacomb-threshold-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f02.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "Then take what opens it.",
        "expression": "hopeful",
        "pose": "reaching-forward",
        "stage": "right",
        "background": "catacomb-threshold-soft",
        "artState": "princess.corrupt-1"
      },
      {
        "id": "floor.f02.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "The door first. The ordinary room after. I have not surrendered either promise.",
        "expression": "resolute",
        "pose": "facing-stair",
        "stage": "left",
        "background": "catacomb-threshold-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f03.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f03.witch.b01",
        "speaker": "witch",
        "text": "A signal proves contact. It does not prove that every impulse crossing it belongs to the person you remember.",
        "expression": "clinical",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-ossuary-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f03.witch.b02",
        "speaker": "prince",
        "text": "You cannot make me distrust my wife because your prison frightens her.",
        "expression": "guarded",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-ossuary-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f03.witch.b03",
        "speaker": "witch",
        "text": "Trust is not the variable. Contamination does not require your consent, only an open channel.",
        "expression": "precise",
        "pose": "one-hand-open",
        "stage": "right",
        "background": "biome-ossuary-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f03.witch.b04",
        "speaker": "prince",
        "text": "Then you should not have given me a reason to keep it open.",
        "expression": "cold",
        "pose": "stepping-past",
        "stage": "left",
        "background": "biome-ossuary-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f03.witch.b05",
        "speaker": "witch",
        "text": "I did not give you the reason. I am telling you that the reason has learned how to use the opening.",
        "expression": "grave",
        "pose": "projection-dimming",
        "stage": "right",
        "background": "biome-ossuary-graded",
        "artState": "witch.clinical"
      }
    ]
  },
  {
    "id": "floor.f03.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f03.upgrade.r01.b01",
        "speaker": "princess",
        "text": "She spoke about the ring again. As if our life together were an exposed wound she could classify.",
        "expression": "hurt",
        "pose": "arms-close",
        "stage": "right",
        "background": "biome-ossuary-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f03.upgrade.r01.b02",
        "speaker": "prince",
        "text": "She spoke. I kept walking.",
        "expression": "reassuring",
        "pose": "facing-her",
        "stage": "left",
        "background": "biome-ossuary-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f03.upgrade.r01.b03",
        "speaker": "princess",
        "text": "Is that all? No doubt at all?",
        "expression": "searching",
        "pose": "reaching-halfway",
        "stage": "right",
        "background": "biome-ossuary-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f03.upgrade.r01.b04",
        "speaker": "prince",
        "text": "I doubt only her account. Not that you are frightened, not that she took you, and not that I know your voice.",
        "expression": "honest",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "biome-ossuary-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f03.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Good. Hold to that. Choose something she cannot turn into another delay.",
        "expression": "relieved",
        "pose": "lowering-shoulders",
        "stage": "right",
        "background": "biome-ossuary-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f03.upgrade.r01.b06",
        "speaker": "prince",
        "text": "Whatever she says, you do not have to defend our marriage from her. I will do that by reaching you.",
        "expression": "protective",
        "pose": "lifting-scythe",
        "stage": "left",
        "background": "biome-ossuary-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f03.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f03.upgrade.r02.b01",
        "speaker": "princess",
        "text": "The distance folded when that chamber fell. I felt you arrive before the last echo stopped.",
        "expression": "intent",
        "pose": "leaning-forward",
        "stage": "right",
        "background": "biome-ossuary-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f03.upgrade.r02.b02",
        "speaker": "prince",
        "text": "You are measuring floors now. Yesterday you could barely speak.",
        "expression": "concerned",
        "pose": "wiping-blade",
        "stage": "left",
        "background": "biome-ossuary-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f03.upgrade.r02.b03",
        "speaker": "princess",
        "text": "The bond strengthens as you descend. Let one mercy live in this place.",
        "expression": "reassuring",
        "pose": "hand-to-ring",
        "stage": "right",
        "background": "biome-ossuary-soft",
        "artState": "princess.corrupt-1"
      },
      {
        "id": "floor.f03.upgrade.r02.b04",
        "speaker": "prince",
        "text": "A mercy would be knowing what she has done to you.",
        "expression": "resolved",
        "pose": "sheathing-scythe",
        "stage": "left",
        "background": "biome-ossuary-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f03.upgrade.r02.b05",
        "speaker": "princess",
        "text": "Reach me first. Questions will survive the distance. I am less certain we will.",
        "expression": "evasive",
        "pose": "looking-aside",
        "stage": "right",
        "background": "biome-ossuary-soft",
        "artState": "princess.corrupt-1"
      },
      {
        "id": "floor.f03.upgrade.r02.b06",
        "speaker": "prince",
        "text": "We survived years of questions. Do not make the distance sound hungrier than it is.",
        "expression": "concerned",
        "pose": "searching-her-face",
        "stage": "left",
        "background": "biome-ossuary-soft",
        "artState": "prince.alarmed"
      }
    ]
  },
  {
    "id": "floor.f03.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f03.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "The next seal is thicker. I feel it pressing back whenever the ring warms.",
        "expression": "urgent",
        "pose": "palm-against-barrier",
        "stage": "right",
        "background": "ossuary-threshold-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f03.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "Can you weaken it from your side?",
        "expression": "focused",
        "pose": "examining-door",
        "stage": "left",
        "background": "ossuary-threshold-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f03.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "Not without losing the thread. Break it from yours, and I can keep the opening from closing.",
        "expression": "strained",
        "pose": "pushing-palm",
        "stage": "right",
        "background": "ossuary-threshold-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f03.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "You know the locks well for a prisoner.",
        "expression": "suspicious",
        "pose": "studying-her",
        "stage": "left",
        "background": "ossuary-threshold-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f03.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "I know what has pressed against me. Please, Zephyr. Choose, then break it.",
        "expression": "pained",
        "pose": "withdrawing-hand",
        "stage": "right",
        "background": "ossuary-threshold-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f03.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "I will break the lock. When I reach you, we begin with the questions you keep postponing.",
        "expression": "resolved-uneasy",
        "pose": "touching-seal",
        "stage": "left",
        "background": "ossuary-threshold-soft",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f04.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f04.witch.b01",
        "speaker": "witch",
        "text": "The responses below are losing consistency. Some defend thresholds. Others abandon position merely to reach you.",
        "expression": "observing",
        "pose": "projection-turned",
        "stage": "right",
        "background": "biome-ruins-graded",
        "artState": "witch.observing"
      },
      {
        "id": "floor.f04.witch.b02",
        "speaker": "prince",
        "text": "Call them off.",
        "expression": "accusatory",
        "pose": "scythe-forward",
        "stage": "left",
        "background": "biome-ruins-graded",
        "artState": "prince.enraged"
      },
      {
        "id": "floor.f04.witch.b03",
        "speaker": "witch",
        "text": "You continue to misunderstand the word “mine.”",
        "expression": "clinical",
        "pose": "hands-folded",
        "stage": "right",
        "background": "biome-ruins-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f04.witch.b04",
        "speaker": "prince",
        "text": "I understand that every answer from you protects the same locked door.",
        "expression": "grim",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "biome-ruins-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f04.witch.b05",
        "speaker": "witch",
        "text": "Correct. You have not yet asked what the door protects from what.",
        "expression": "exact",
        "pose": "projection-fading",
        "stage": "right",
        "background": "biome-ruins-graded",
        "artState": "witch.clinical"
      }
    ]
  },
  {
    "id": "floor.f04.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f04.upgrade.r01.b01",
        "speaker": "princess",
        "text": "You are putting more weight on the scythe between steps. Your knees hurt.",
        "expression": "attentive",
        "pose": "studying-posture",
        "stage": "right",
        "background": "biome-ruins-soft",
        "artState": "princess.corrupt-1"
      },
      {
        "id": "floor.f04.upgrade.r01.b02",
        "speaker": "prince",
        "text": "My knees have filed no complaint.",
        "expression": "dry",
        "pose": "standing-straight",
        "stage": "left",
        "background": "biome-ruins-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f04.upgrade.r01.b03",
        "speaker": "princess",
        "text": "They complained through an entire harvest festival. I remember because you blamed the ceremonial boots.",
        "expression": "fond",
        "pose": "hands-on-hips",
        "stage": "right",
        "background": "biome-ruins-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f04.upgrade.r01.b04",
        "speaker": "prince",
        "text": "The boots were an act of war.",
        "expression": "affectionate",
        "pose": "slight-smile",
        "stage": "left",
        "background": "biome-ruins-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f04.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Then prepare for another. Choose what lets you move without borrowing pain from tomorrow.",
        "expression": "warm",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-ruins-soft",
        "artState": "princess.affectionate"
      },
      {
        "id": "floor.f04.upgrade.r01.b06",
        "speaker": "prince",
        "text": "There you are. For one breath, this sounds like our study instead of her prison.",
        "expression": "softened",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "biome-ruins-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f04.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f04.upgrade.r02.b01",
        "speaker": "princess",
        "text": "The barrier behind you is knitting itself closed. She is buying time with every pause.",
        "expression": "urgent",
        "pose": "looking-behind",
        "stage": "right",
        "background": "biome-ruins-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f04.upgrade.r02.b02",
        "speaker": "prince",
        "text": "It opened after the room fell. Why close it now?",
        "expression": "alert",
        "pose": "glancing-back",
        "stage": "left",
        "background": "biome-ruins-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f04.upgrade.r02.b03",
        "speaker": "princess",
        "text": "Because you are closer than she expected. Do not let her repair what you have broken.",
        "expression": "tense",
        "pose": "gripping-ring",
        "stage": "right",
        "background": "biome-ruins-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f04.upgrade.r02.b04",
        "speaker": "prince",
        "text": "You sound as if you can see it.",
        "expression": "searching",
        "pose": "facing-her",
        "stage": "left",
        "background": "biome-ruins-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f04.upgrade.r02.b05",
        "speaker": "princess",
        "text": "I feel every lock between us. Take the quickest answer and move.",
        "expression": "evasive",
        "pose": "eyes-down",
        "stage": "right",
        "background": "biome-ruins-soft",
        "artState": "princess.corrupt-2"
      },
      {
        "id": "floor.f04.upgrade.r02.b06",
        "speaker": "prince",
        "text": "I will move. I will also remember that you answered the lock and not the question.",
        "expression": "guarded",
        "pose": "turning-to-door",
        "stage": "left",
        "background": "biome-ruins-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f04.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f04.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "When this one opens, the pull should be strong enough to feel like a hand.",
        "expression": "yearning",
        "pose": "reaching-forward",
        "stage": "right",
        "background": "ruins-threshold-soft",
        "artState": "princess.corrupt-2"
      },
      {
        "id": "floor.f04.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "Yours?",
        "expression": "tender",
        "pose": "lifting-ring-hand",
        "stage": "left",
        "background": "ruins-threshold-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f04.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "Who else's would you follow this far?",
        "expression": "intimate",
        "pose": "palm-raised",
        "stage": "right",
        "background": "ruins-threshold-soft",
        "artState": "princess.corrupt-2"
      },
      {
        "id": "floor.f04.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "No one's. That is why the Witch's warnings fail.",
        "expression": "quiet",
        "pose": "matching-palm",
        "stage": "left",
        "background": "ruins-threshold-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f04.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "Then choose. Break the lock. Put your hand back in mine.",
        "expression": "intent",
        "pose": "fingers-closing",
        "stage": "right",
        "background": "ruins-threshold-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f04.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "It never left. That is why I can feel how hard you are pulling.",
        "expression": "devoted",
        "pose": "matching-grip",
        "stage": "left",
        "background": "ruins-threshold-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f05.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f05.witch.b01",
        "speaker": "witch",
        "text": "Watch their arrivals. Mine enter where the ward permits, in ranks, facing outward. The others tear through wherever your presence draws them.",
        "expression": "observing",
        "pose": "indicating-ranks",
        "stage": "right",
        "background": "biome-charnel-graded",
        "artState": "witch.observing"
      },
      {
        "id": "floor.f05.witch.b02",
        "speaker": "prince",
        "text": "Another distinction only you can verify. Convenient.",
        "expression": "skeptical",
        "pose": "scythe-lowered",
        "stage": "left",
        "background": "biome-charnel-graded",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f05.witch.b03",
        "speaker": "witch",
        "text": "The floor verifies it. Spacing, posture, residue. Observation requires no trust.",
        "expression": "clinical",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-charnel-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f05.witch.b04",
        "speaker": "prince",
        "text": "And what conclusion have you prepared for me?",
        "expression": "guarded",
        "pose": "looking-past",
        "stage": "left",
        "background": "biome-charnel-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f05.witch.b05",
        "speaker": "witch",
        "text": "None. A conclusion you are given can be refused. A pattern you notice must be carried.",
        "expression": "precise",
        "pose": "hands-folded",
        "stage": "right",
        "background": "biome-charnel-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f05.witch.b06",
        "speaker": "prince",
        "text": "I will carry what I see. Do not mistake that for carrying your judgment with it.",
        "expression": "unsettled",
        "pose": "looking-at-arena",
        "stage": "left",
        "background": "biome-charnel-graded",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f05.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f05.upgrade.r01.b01",
        "speaker": "princess",
        "text": "Hold still. The ring keeps losing the edges of you whenever you bleed.",
        "expression": "intense",
        "pose": "inspecting-him",
        "stage": "right",
        "background": "biome-charnel-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f05.upgrade.r01.b02",
        "speaker": "prince",
        "text": "Losing them to what?",
        "expression": "concerned",
        "pose": "checking-ring",
        "stage": "left",
        "background": "biome-charnel-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f05.upgrade.r01.b03",
        "speaker": "princess",
        "text": "Distance. Her wards. All the little things trying to decide how much of you reaches me.",
        "expression": "possessive-soft",
        "pose": "reaching-forward",
        "stage": "right",
        "background": "biome-charnel-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f05.upgrade.r01.b04",
        "speaker": "prince",
        "text": "Enough will reach you.",
        "expression": "reassuring",
        "pose": "squaring-shoulders",
        "stage": "left",
        "background": "biome-charnel-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f05.upgrade.r01.b05",
        "speaker": "princess",
        "text": "I do not want enough. Choose something that leaves nothing behind.",
        "expression": "fixed",
        "pose": "hand-closing",
        "stage": "right",
        "background": "biome-charnel-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f05.upgrade.r01.b06",
        "speaker": "prince",
        "text": "Nothing left behind is not a promise anyone can make. Let me arrive before you ask it.",
        "expression": "uneasy",
        "pose": "drawing-hand-back",
        "stage": "left",
        "background": "biome-charnel-soft",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f05.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f05.upgrade.r02.b01",
        "speaker": "princess",
        "text": "Stop weighing every cost. Choose what ends the next fight before it begins.",
        "expression": "impatient",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-charnel-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f05.upgrade.r02.b02",
        "speaker": "prince",
        "text": "You used to say a cost ignored becomes someone else's wound.",
        "expression": "taken-aback",
        "pose": "lowering-hand",
        "stage": "left",
        "background": "biome-charnel-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f05.upgrade.r02.b03",
        "speaker": "princess",
        "text": "I used to say that in rooms with windows. Here, caution is another hand on the door.",
        "expression": "strained",
        "pose": "looking-away",
        "stage": "right",
        "background": "biome-charnel-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f05.upgrade.r02.b04",
        "speaker": "prince",
        "text": "Fear never made you careless.",
        "expression": "watchful",
        "pose": "studying-her",
        "stage": "left",
        "background": "biome-charnel-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f05.upgrade.r02.b05",
        "speaker": "princess",
        "text": "It made me tired of losing things while careful people explained the necessity. Please. Take the stronger answer.",
        "expression": "defensive-warm",
        "pose": "hand-to-heart",
        "stage": "right",
        "background": "biome-charnel-soft",
        "artState": "princess.corrupt-2"
      },
      {
        "id": "floor.f05.upgrade.r02.b06",
        "speaker": "prince",
        "text": "I will choose for the room ahead because it is real. We will speak about the rest where I can see you.",
        "expression": "troubled",
        "pose": "considering-offer",
        "stage": "left",
        "background": "biome-charnel-soft",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f05.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f05.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "This place has taken enough time from us. I can feel every closed door like a thing being carried away.",
        "expression": "haunted",
        "pose": "holding-ring",
        "stage": "right",
        "background": "charnel-threshold-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f05.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "Time is not gone because we cannot touch it.",
        "expression": "gentle",
        "pose": "scythe-grounded",
        "stage": "left",
        "background": "charnel-threshold-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f05.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "That is what people say when they have decided loss is natural.",
        "expression": "distant",
        "pose": "looking-through-him",
        "stage": "right",
        "background": "charnel-threshold-soft",
        "artState": "princess.corrupt-2"
      },
      {
        "id": "floor.f05.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "Elowen. Look at me.",
        "expression": "concerned",
        "pose": "stepping-closer",
        "stage": "left",
        "background": "charnel-threshold-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f05.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "I am. I see you descending when every sensible part of you should turn back. Choose before the next door takes more.",
        "expression": "recovering",
        "pose": "meeting-his-gaze",
        "stage": "right",
        "background": "charnel-threshold-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f05.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "The door takes distance. It does not take the years behind us. Let that be enough until I arrive.",
        "expression": "gentle-firm",
        "pose": "lifting-ring-hand",
        "stage": "left",
        "background": "charnel-threshold-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f06.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f06.witch.b01",
        "speaker": "witch",
        "text": "Her voice has changed. The pauses shorten, the imperatives multiply, and concern follows only after she hears herself.",
        "expression": "observing",
        "pose": "projection-close",
        "stage": "right",
        "background": "biome-vault-graded",
        "artState": "witch.observing"
      },
      {
        "id": "floor.f06.witch.b02",
        "speaker": "prince",
        "text": "You hurt her, then describe the sound as evidence.",
        "expression": "defensive",
        "pose": "scythe-between",
        "stage": "left",
        "background": "biome-vault-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f06.witch.b03",
        "speaker": "witch",
        "text": "Pain disrupts a person. Deterioration rearranges what the person values. I know the difference.",
        "expression": "clinical",
        "pose": "hands-folded",
        "stage": "right",
        "background": "biome-vault-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f06.witch.b04",
        "speaker": "prince",
        "text": "You know conditions. You do not know Elowen.",
        "expression": "angry-contained",
        "pose": "stepping-past",
        "stage": "left",
        "background": "biome-vault-graded",
        "artState": "prince.enraged"
      },
      {
        "id": "floor.f06.witch.b05",
        "speaker": "witch",
        "text": "Then listen for the moment she stops knowing you.",
        "expression": "severe",
        "pose": "projection-fading",
        "stage": "right",
        "background": "biome-vault-graded",
        "artState": "witch.warning"
      },
      {
        "id": "floor.f06.witch.b06",
        "speaker": "prince",
        "text": "I will listen to her, not to the verdict you have prepared around her.",
        "expression": "resolute",
        "pose": "moving-on",
        "stage": "left",
        "background": "biome-vault-graded",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f06.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f06.upgrade.r01.b01",
        "speaker": "princess",
        "text": "Take the sharpest gift. Strip them to the bone and make the walls remember—",
        "expression": "impatient",
        "pose": "thrusting-hand",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f06.upgrade.r01.b02",
        "speaker": "princess",
        "text": "No. Zephyr, no. That was not what I meant to say.",
        "expression": "horrified",
        "pose": "covering-mouth",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f06.upgrade.r01.b03",
        "speaker": "prince",
        "text": "I heard you.",
        "expression": "shaken",
        "pose": "lowering-scythe",
        "stage": "left",
        "background": "biome-vault-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f06.upgrade.r01.b04",
        "speaker": "princess",
        "text": "She catches my words and bends them before they reach the ring. You know how I speak. You know what I would never ask.",
        "expression": "pleading",
        "pose": "hands-open",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f06.upgrade.r01.b05",
        "speaker": "prince",
        "text": "I know. Hold to my voice instead.",
        "expression": "protective",
        "pose": "gripping-ring",
        "stage": "left",
        "background": "biome-vault-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f06.upgrade.r01.b06",
        "speaker": "princess",
        "text": "I am trying. Choose something clean. Something you can still call your own.",
        "expression": "fragile",
        "pose": "nodding",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f06.upgrade.r01.b07",
        "speaker": "prince",
        "text": "My choice, my hand, my road. Hold to those facts until I can reach you.",
        "expression": "steadying-her",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-vault-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f06.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f06.upgrade.r02.b01",
        "speaker": "princess",
        "text": "Do you remember the rain inside the east gallery? Every roof tile sound, no leak anywhere.",
        "expression": "deliberately-gentle",
        "pose": "seated-memory",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.corrupt-3"
      },
      {
        "id": "floor.f06.upgrade.r02.b02",
        "speaker": "prince",
        "text": "You made the guards move twelve paintings. The rain was a nesting bird.",
        "expression": "cautious",
        "pose": "scythe-grounded",
        "stage": "left",
        "background": "biome-vault-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f06.upgrade.r02.b03",
        "speaker": "princess",
        "text": "You complained for hours and moved the heaviest one yourself. See? I remember. I am still here.",
        "expression": "soft",
        "pose": "small-smile",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.corrupt-3"
      },
      {
        "id": "floor.f06.upgrade.r02.b04",
        "speaker": "prince",
        "text": "You never had to prove that before.",
        "expression": "tender-uneasy",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "biome-vault-soft",
        "artState": "prince.affectionate"
      },
      {
        "id": "floor.f06.upgrade.r02.b05",
        "speaker": "princess",
        "text": "I never had to speak through her walls. Let this gift be gentler than the last.",
        "expression": "strained",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-vault-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f06.upgrade.r02.b06",
        "speaker": "prince",
        "text": "I remember the gallery. I also remember you never asking me to prove that I remembered.",
        "expression": "uneasy-tender",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "biome-vault-soft",
        "artState": "prince.affectionate"
      }
    ]
  },
  {
    "id": "floor.f06.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f06.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "The next stair is open. Do not spend long deciding.",
        "expression": "tired",
        "pose": "listening-away",
        "stage": "right",
        "background": "vault-threshold-soft",
        "artState": "princess.frightened"
      },
      {
        "id": "floor.f06.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "A moment ago you wanted me careful.",
        "expression": "watchful",
        "pose": "arms-lowered",
        "stage": "left",
        "background": "vault-threshold-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f06.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "Careful, yes. Motionless, no. The walls settle around hesitation.",
        "expression": "controlled",
        "pose": "clasping-hands",
        "stage": "right",
        "background": "vault-threshold-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f06.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "Is that what they do, or what you fear?",
        "expression": "probing",
        "pose": "slight-step",
        "stage": "left",
        "background": "vault-threshold-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f06.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "Does the difference help us? Choose. I need you moving again.",
        "expression": "impatient-soft",
        "pose": "reaching",
        "stage": "right",
        "background": "vault-threshold-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f06.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "It helps me know which answer is yours. I am moving, but I will keep asking.",
        "expression": "guarded",
        "pose": "facing-stair",
        "stage": "left",
        "background": "vault-threshold-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f07.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f07.witch.b01",
        "speaker": "witch",
        "text": "The force strengthening you leaves the same residue as the unstable dead. It does not match my wards.",
        "expression": "clinical",
        "pose": "holding-residue-light",
        "stage": "right",
        "background": "biome-depths-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f07.witch.b02",
        "speaker": "prince",
        "text": "She would never send those things against me.",
        "expression": "angry",
        "pose": "scythe-ready",
        "stage": "left",
        "background": "biome-depths-graded",
        "artState": "prince.enraged"
      },
      {
        "id": "floor.f07.witch.b03",
        "speaker": "witch",
        "text": "That answer assumes she can still choose one purpose and keep it. The evidence does not support your assumption.",
        "expression": "precise",
        "pose": "releasing-residue",
        "stage": "right",
        "background": "biome-depths-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f07.witch.b04",
        "speaker": "prince",
        "text": "The same bond lets her help me. You are making similarity carry your accusation.",
        "expression": "defensive",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-depths-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f07.witch.b05",
        "speaker": "witch",
        "text": "No. You are making affection erase a measurement.",
        "expression": "severe",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-depths-graded",
        "artState": "witch.warning"
      },
      {
        "id": "floor.f07.witch.b06",
        "speaker": "prince",
        "text": "A measurement is not a motive. Similar marks do not tell me who meant harm.",
        "expression": "unsettled",
        "pose": "studying-residue",
        "stage": "left",
        "background": "biome-depths-graded",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f07.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f07.upgrade.r01.b01",
        "speaker": "princess",
        "text": "Take something with reach. The next chamber opens narrow, then widens behind the second pillar. They will crowd the mouth.",
        "expression": "intent",
        "pose": "looking-beyond-him",
        "stage": "right",
        "background": "biome-depths-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f07.upgrade.r01.b02",
        "speaker": "prince",
        "text": "I have not opened that door.",
        "expression": "suspicious",
        "pose": "glancing-back",
        "stage": "left",
        "background": "biome-depths-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f07.upgrade.r01.b03",
        "speaker": "princess",
        "text": "I feel the shape of every obstacle between us.",
        "expression": "too-calm",
        "pose": "touching-ring",
        "stage": "right",
        "background": "biome-depths-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f07.upgrade.r01.b04",
        "speaker": "prince",
        "text": "Obstacles do not tell you where enemies will stand. How do you know?",
        "expression": "probing",
        "pose": "stepping-closer",
        "stage": "left",
        "background": "biome-depths-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f07.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Because this place repeats its cruelties. Choose reach, Zephyr. You can question the room after you survive it.",
        "expression": "impatient",
        "pose": "hand-closing",
        "stage": "right",
        "background": "biome-depths-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f07.upgrade.r01.b06",
        "speaker": "prince",
        "text": "I will survive it. Your answer will still be waiting when I do.",
        "expression": "watchful",
        "pose": "scythe-grounded",
        "stage": "left",
        "background": "biome-depths-soft",
        "artState": "prince.alarmed"
      }
    ]
  },
  {
    "id": "floor.f07.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f07.upgrade.r02.b01",
        "speaker": "princess",
        "text": "They keep reforming behind you because you leave too much standing. Break the center, and the rest will fold.",
        "expression": "fierce",
        "pose": "fist-closed",
        "stage": "right",
        "background": "biome-depths-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f07.upgrade.r02.b02",
        "speaker": "prince",
        "text": "You speak as if the fighting matters more than where it leads.",
        "expression": "guarded",
        "pose": "wiping-blade",
        "stage": "left",
        "background": "biome-depths-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f07.upgrade.r02.b03",
        "speaker": "princess",
        "text": "The fighting is the only language these halls respect.",
        "expression": "cold-briefly",
        "pose": "leaning-forward",
        "stage": "right",
        "background": "biome-depths-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f07.upgrade.r02.b04",
        "speaker": "prince",
        "text": "That was never your language.",
        "expression": "quiet",
        "pose": "watching-her",
        "stage": "left",
        "background": "biome-depths-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f07.upgrade.r02.b05",
        "speaker": "princess",
        "text": "It is the one I have been forced to learn. Give me the mercy of learning it well. Choose what breaks them.",
        "expression": "strained-warm",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-depths-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f07.upgrade.r02.b06",
        "speaker": "prince",
        "text": "Mercy should leave something standing. I will choose what opens a path, not what pleases this place.",
        "expression": "conflicted",
        "pose": "weighing-offer",
        "stage": "left",
        "background": "biome-depths-soft",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f07.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f07.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "When you reach the bottom, do not bargain with her. Do not ask for terms. Kill the Witch.",
        "expression": "commanding",
        "pose": "standing-tall",
        "stage": "right",
        "background": "depths-threshold-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f07.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "I came to bring you home, not execute someone on command.",
        "expression": "startled",
        "pose": "scythe-lowered",
        "stage": "left",
        "background": "depths-threshold-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f07.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "She will use every breath you give her to close another door. You cannot negotiate with a hand around my throat.",
        "expression": "intense",
        "pose": "stepping-forward",
        "stage": "right",
        "background": "depths-threshold-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f07.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "I decide what the scythe does.",
        "expression": "firm",
        "pose": "meeting-gaze",
        "stage": "left",
        "background": "depths-threshold-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f07.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "Then decide for us. Choose strength now, and leave her no final measure of me.",
        "expression": "possessive-soft",
        "pose": "touching-ring",
        "stage": "right",
        "background": "depths-threshold-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f07.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "I will decide when I see her. Until then, you are asking and I am listening. Keep that difference.",
        "expression": "firm",
        "pose": "hand-away-from-ring",
        "stage": "left",
        "background": "depths-threshold-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f08.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f08.witch.b01",
        "speaker": "witch",
        "text": "Her condition is progressive. The intervals in which intention and speech agree are shortening.",
        "expression": "grave-clinical",
        "pose": "projection-close",
        "stage": "right",
        "background": "biome-sanctum-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f08.witch.b02",
        "speaker": "prince",
        "text": "You call her a condition because it saves you from calling her a person.",
        "expression": "furious-contained",
        "pose": "scythe-forward",
        "stage": "left",
        "background": "biome-sanctum-graded",
        "artState": "prince.enraged"
      },
      {
        "id": "floor.f08.witch.b03",
        "speaker": "witch",
        "text": "A fair indictment. It does not alter the prognosis.",
        "expression": "accepting",
        "pose": "hands-open",
        "stage": "right",
        "background": "biome-sanctum-graded",
        "artState": "witch.acceptance"
      },
      {
        "id": "floor.f08.witch.b04",
        "speaker": "prince",
        "text": "You do not know what can return once she is free of you.",
        "expression": "hurt",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-sanctum-graded",
        "artState": "prince.devastated"
      },
      {
        "id": "floor.f08.witch.b05",
        "speaker": "witch",
        "text": "I know this process does not reverse. Hope is not contrary evidence.",
        "expression": "exact",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-sanctum-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f08.witch.b06",
        "speaker": "prince",
        "text": "Then your evidence will have to survive the person you reduced to it.",
        "expression": "defiant-shaken",
        "pose": "moving-past",
        "stage": "left",
        "background": "biome-sanctum-graded",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f08.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f08.upgrade.r01.b01",
        "speaker": "princess",
        "text": "Choose the strongest gift. Now.",
        "expression": "commanding",
        "pose": "palm-up",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f08.upgrade.r01.b02",
        "speaker": "prince",
        "text": "Ask me.",
        "expression": "guarded",
        "pose": "remaining-still",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f08.upgrade.r01.b03",
        "speaker": "princess",
        "text": "We have no time for ceremony.",
        "expression": "irritated",
        "pose": "fingers-curling",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.corrupt-4"
      },
      {
        "id": "floor.f08.upgrade.r01.b04",
        "speaker": "prince",
        "text": "It was not ceremony when you still cared whether I chose.",
        "expression": "firm",
        "pose": "arms-at-sides",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f08.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Please, then. Choose what makes you stronger. I care whether you arrive; must I decorate every necessity?",
        "expression": "recalibrating",
        "pose": "forced-softness",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.strained"
      },
      {
        "id": "floor.f08.upgrade.r01.b06",
        "speaker": "prince",
        "text": "No. But I am beginning to hear what you leave bare.",
        "expression": "uneasy",
        "pose": "looking-at-ring",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f08.upgrade.r01.b07",
        "speaker": "princess",
        "text": "Good. Hear it while you choose. Strength needs less decoration than fear does.",
        "expression": "coldly-pleased",
        "pose": "slight-smile",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.possessive"
      }
    ]
  },
  {
    "id": "floor.f08.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f08.upgrade.r02.b01",
        "speaker": "princess",
        "text": "You belong with me. Every door you break only proves the world cannot keep what is mine.",
        "expression": "possessive",
        "pose": "both-hands-reaching",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f08.upgrade.r02.b02",
        "speaker": "prince",
        "text": "Elowen—",
        "expression": "shocked",
        "pose": "stepping-back",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f08.upgrade.r02.b03",
        "speaker": "princess",
        "text": "Zephyr, please. Do not trust my voice. Do not follow when it sounds most certain.",
        "expression": "lucid-frightened",
        "pose": "recoiling-from-self",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.lucid"
      },
      {
        "id": "floor.f08.upgrade.r02.b04",
        "speaker": "prince",
        "text": "That was you. Stay with me. Tell me what she is doing.",
        "expression": "desperate",
        "pose": "reaching-forward",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.devastated"
      },
      {
        "id": "floor.f08.upgrade.r02.b05",
        "speaker": "princess",
        "text": "She is delaying you. I said not to trust the voice that asks you to stop. Keep going.",
        "expression": "hijacked-calm",
        "pose": "chin-lifting",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f08.upgrade.r02.b06",
        "speaker": "prince",
        "text": "You changed inside the same breath.",
        "expression": "shaken",
        "pose": "hand-falling",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f08.upgrade.r02.b07",
        "speaker": "princess",
        "text": "Then do not waste the next one. Choose.",
        "expression": "commanding",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-sanctum-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f08.upgrade.r02.b08",
        "speaker": "prince",
        "text": "I will choose. I will not pretend the voice asking is whole.",
        "expression": "shaken-resolute",
        "pose": "hand-lowering",
        "stage": "left",
        "background": "biome-sanctum-soft",
        "artState": "prince.doubtful"
      }
    ]
  },
  {
    "id": "floor.f08.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f08.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "Good. You came despite the frightened little interruption. You still remember how to obey.",
        "expression": "pleased-cold",
        "pose": "watching-him",
        "stage": "right",
        "background": "sanctum-threshold-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f08.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "I remember how to keep a promise.",
        "expression": "wounded",
        "pose": "scythe-grounded",
        "stage": "left",
        "background": "sanctum-threshold-soft",
        "artState": "prince.injured"
      },
      {
        "id": "floor.f08.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "Call it whatever lets you continue. A promise, a pull, a hand at your back. The result is what matters.",
        "expression": "possessive-soft",
        "pose": "touching-ring",
        "stage": "right",
        "background": "sanctum-threshold-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f08.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "You never spoke about us as a result.",
        "expression": "suspicious",
        "pose": "lifting-gaze",
        "stage": "left",
        "background": "sanctum-threshold-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f08.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "We had the luxury of other words. Choose, and earn them back.",
        "expression": "impatient",
        "pose": "gesturing-downward",
        "stage": "right",
        "background": "sanctum-threshold-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f08.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "Words are not wages. If I reach you, they return because you mean them.",
        "expression": "wary",
        "pose": "facing-stair",
        "stage": "left",
        "background": "sanctum-threshold-soft",
        "artState": "prince.alarmed"
      }
    ]
  },
  {
    "id": "floor.f09.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f09.witch.b01",
        "speaker": "witch",
        "text": "That was not fear speaking for most of the exchange. Fear asked you to stop. Something else corrected it.",
        "expression": "grave",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-abyss-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f09.witch.b02",
        "speaker": "prince",
        "text": "I heard Elowen warn me. That proves she is still fighting you.",
        "expression": "defensive-shaken",
        "pose": "gripping-ring",
        "stage": "left",
        "background": "biome-abyss-graded",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f09.witch.b03",
        "speaker": "witch",
        "text": "It proves one lucid interval survived a breath. Then the thing wearing her affection used your hope to reverse it.",
        "expression": "precise",
        "pose": "one-hand-raised",
        "stage": "right",
        "background": "biome-abyss-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f09.witch.b04",
        "speaker": "prince",
        "text": "You speak as if her love were a costume.",
        "expression": "angry",
        "pose": "scythe-forward",
        "stage": "left",
        "background": "biome-abyss-graded",
        "artState": "prince.enraged"
      },
      {
        "id": "floor.f09.witch.b05",
        "speaker": "witch",
        "text": "No. Her love is real. That is why it is useful to what cannot sustain its own purpose.",
        "expression": "restrained",
        "pose": "projection-dimming",
        "stage": "right",
        "background": "biome-abyss-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f09.witch.b06",
        "speaker": "prince",
        "text": "If it is real, there is something left to reach. You have admitted more than you intended.",
        "expression": "pained",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-abyss-graded",
        "artState": "prince.injured"
      }
    ]
  },
  {
    "id": "floor.f09.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f09.upgrade.r01.b01",
        "speaker": "princess",
        "text": "The careful ones are hers. See how neatly they hold the door, shields turned outward, every gap measured?",
        "expression": "knowing",
        "pose": "indicating-distant-ranks",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f09.upgrade.r01.b02",
        "speaker": "prince",
        "text": "And the ones that tore through their line to reach me?",
        "expression": "wary",
        "pose": "following-gesture",
        "stage": "left",
        "background": "biome-abyss-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f09.upgrade.r01.b03",
        "speaker": "princess",
        "text": "Does a corpse need a pedigree before you cut it down?",
        "expression": "evasive-cold",
        "pose": "hand-lowering",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f09.upgrade.r01.b04",
        "speaker": "prince",
        "text": "You knew the room before I opened it. Now you know which creatures answer her. What are the others?",
        "expression": "insistent",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "biome-abyss-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f09.upgrade.r01.b05",
        "speaker": "princess",
        "text": "In your way. Choose what removes them. Names are another delay.",
        "expression": "impatient",
        "pose": "open-palm",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f09.upgrade.r01.b06",
        "speaker": "prince",
        "text": "That sounds like her. The answer does not.",
        "expression": "troubled",
        "pose": "looking-at-ring",
        "stage": "left",
        "background": "biome-abyss-soft",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f09.upgrade.r01.b07",
        "speaker": "princess",
        "text": "Then listen to the useful part. The next door does not care which voice satisfies you.",
        "expression": "dismissive",
        "pose": "turning-away",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.possessive"
      }
    ]
  },
  {
    "id": "floor.f09.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f09.upgrade.r02.b01",
        "speaker": "princess",
        "text": "Another door. Break it quickly. I can almost feel the air move around you.",
        "expression": "strained-commanding",
        "pose": "reaching",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f09.upgrade.r02.b02",
        "speaker": "prince",
        "text": "Elowen, if any part of you can hear without answering, tap the ring twice.",
        "expression": "gentle-desperate",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "biome-abyss-soft",
        "artState": "prince.devastated"
      },
      {
        "id": "floor.f09.upgrade.r02.b03",
        "speaker": "princess",
        "text": "Stop. Please, do not come any closer. I cannot keep—",
        "expression": "lucid-terrified",
        "pose": "tapping-ring-twice",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.lucid"
      },
      {
        "id": "floor.f09.upgrade.r02.b04",
        "speaker": "princess",
        "text": "Keep waiting. That is what she wants. Come to me now.",
        "expression": "hijacked-intense",
        "pose": "gripping-ring",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f09.upgrade.r02.b05",
        "speaker": "prince",
        "text": "You gave me both answers.",
        "expression": "devastated",
        "pose": "frozen",
        "stage": "left",
        "background": "biome-abyss-soft",
        "artState": "prince.devastated"
      },
      {
        "id": "floor.f09.upgrade.r02.b06",
        "speaker": "princess",
        "text": "I gave you the one that moves your feet. Choose, Zephyr.",
        "expression": "cold",
        "pose": "palm-up",
        "stage": "right",
        "background": "biome-abyss-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f09.upgrade.r02.b07",
        "speaker": "prince",
        "text": "I heard the other one too. I am carrying both, whether you permit it or not.",
        "expression": "grief-hardened",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-abyss-soft",
        "artState": "prince.enraged"
      }
    ]
  },
  {
    "id": "floor.f09.upgrade.threshold",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f09.upgrade.threshold.b01",
        "speaker": "princess",
        "text": "Your breath pauses every time doubt reaches the ring. I feel each pause as if you were pulling your hand from mine.",
        "expression": "possessive",
        "pose": "listening",
        "stage": "right",
        "background": "abyss-threshold-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f09.upgrade.threshold.b02",
        "speaker": "prince",
        "text": "Perhaps I need my hand free.",
        "expression": "guarded",
        "pose": "hand-away-from-ring",
        "stage": "left",
        "background": "abyss-threshold-soft",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f09.upgrade.threshold.b03",
        "speaker": "princess",
        "text": "For what? She has shown you doors, dead things, and a practiced expression of concern. I have shown you the way to me.",
        "expression": "sharp",
        "pose": "reaching",
        "stage": "right",
        "background": "abyss-threshold-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f09.upgrade.threshold.b04",
        "speaker": "prince",
        "text": "You have shown me more than one way.",
        "expression": "quiet",
        "pose": "meeting-gaze",
        "stage": "left",
        "background": "abyss-threshold-soft",
        "artState": "prince.calm"
      },
      {
        "id": "floor.f09.upgrade.threshold.b05",
        "speaker": "princess",
        "text": "Then choose the one that ends the distance. I can feel every breath you waste.",
        "expression": "commanding",
        "pose": "fingers-closing",
        "stage": "right",
        "background": "abyss-threshold-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f09.upgrade.threshold.b06",
        "speaker": "prince",
        "text": "This breath is mine. So is the choice. Wait for me without trying to own either.",
        "expression": "controlled",
        "pose": "taking-one-breath",
        "stage": "left",
        "background": "abyss-threshold-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f10.witch",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "floorProjection",
    "beats": [
      {
        "id": "floor.f10.witch.b01",
        "speaker": "witch",
        "text": "She guided you here. She strengthened you. The same influence drew unstable dead across my wards and placed them in your path.",
        "expression": "final-warning",
        "pose": "projection-full",
        "stage": "right",
        "background": "biome-containment-graded",
        "artState": "witch.warning"
      },
      {
        "id": "floor.f10.witch.b02",
        "speaker": "prince",
        "text": "You placed armies in every room. Do not divide your guilt now.",
        "expression": "shaken-angry",
        "pose": "scythe-ready",
        "stage": "left",
        "background": "biome-containment-graded",
        "artState": "prince.doubtful"
      },
      {
        "id": "floor.f10.witch.b03",
        "speaker": "witch",
        "text": "My forces held lines. The others broke those lines to reach you. One purpose defended containment. The other could not remain coherent long enough to preserve you.",
        "expression": "precise",
        "pose": "hands-open",
        "stage": "right",
        "background": "biome-containment-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f10.witch.b04",
        "speaker": "prince",
        "text": "She warned me. She is still in there.",
        "expression": "defensive",
        "pose": "hand-over-ring",
        "stage": "left",
        "background": "biome-containment-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f10.witch.b05",
        "speaker": "witch",
        "text": "Yes. Briefly. That does not make release survivable. It makes your part in it more painful.",
        "expression": "grave",
        "pose": "projection-still",
        "stage": "right",
        "background": "biome-containment-graded",
        "artState": "witch.clinical"
      },
      {
        "id": "floor.f10.witch.b06",
        "speaker": "prince",
        "text": "I will hear the answer from her.",
        "expression": "absolute",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "biome-containment-graded",
        "artState": "prince.resolved"
      },
      {
        "id": "floor.f10.witch.b07",
        "speaker": "witch",
        "text": "Kill me, and you will understand what you have freed. Understanding will arrive after it can help you.",
        "expression": "resigned",
        "pose": "projection-fading",
        "stage": "right",
        "background": "biome-containment-graded",
        "artState": "witch.acceptance"
      },
      {
        "id": "floor.f10.witch.b08",
        "speaker": "prince",
        "text": "Then stop standing between me and the answer.",
        "expression": "grim",
        "pose": "entering-final-floor",
        "stage": "left",
        "background": "biome-containment-graded",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "floor.f10.upgrade.r01",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f10.upgrade.r01.b01",
        "speaker": "princess",
        "text": "You are bleeding again. How inconvenient.",
        "expression": "cold",
        "pose": "inspecting-wounds",
        "stage": "right",
        "background": "biome-containment-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f10.upgrade.r01.b02",
        "speaker": "prince",
        "text": "Inconvenient?",
        "expression": "hurt",
        "pose": "looking-up",
        "stage": "left",
        "background": "biome-containment-soft",
        "artState": "prince.devastated"
      },
      {
        "id": "floor.f10.upgrade.r01.b03",
        "speaker": "princess",
        "text": "It slows you. Do not ask the wound to become a moral lesson. Close it, ignore it, or spend enough power that nothing touches you again.",
        "expression": "impatient",
        "pose": "palm-up",
        "stage": "right",
        "background": "biome-containment-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f10.upgrade.r01.b04",
        "speaker": "prince",
        "text": "You once noticed pain before purpose.",
        "expression": "searching",
        "pose": "lowering-scythe",
        "stage": "left",
        "background": "biome-containment-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f10.upgrade.r01.b05",
        "speaker": "princess",
        "text": "Purpose is what brings you to me. Choose.",
        "expression": "unmoved",
        "pose": "fingers-curling",
        "stage": "right",
        "background": "biome-containment-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f10.upgrade.r01.b06",
        "speaker": "prince",
        "text": "I will choose because I still believe someone behind that voice needs me. Do not make me regret being right.",
        "expression": "devastated-contained",
        "pose": "weighing-offer",
        "stage": "left",
        "background": "biome-containment-soft",
        "artState": "prince.devastated"
      }
    ]
  },
  {
    "id": "floor.f10.upgrade.r02",
    "presentation": "vn",
    "repeat": "perOffer",
    "sceneRole": "upgradeEncounter",
    "beats": [
      {
        "id": "floor.f10.upgrade.r02.b01",
        "speaker": "princess",
        "text": "One chamber remains. Give me the Witch's last breath, love, and I will give you every stolen morning back.",
        "expression": "triumphant",
        "pose": "arms-open",
        "stage": "right",
        "background": "containment-antechamber-soft",
        "artState": "princess.triumphant"
      },
      {
        "id": "floor.f10.upgrade.r02.b02",
        "speaker": "prince",
        "text": "You speak about her death as if it were a gift waiting to be opened.",
        "expression": "anguished",
        "pose": "hand-to-ring",
        "stage": "left",
        "background": "containment-antechamber-soft",
        "artState": "prince.devastated"
      },
      {
        "id": "floor.f10.upgrade.r02.b03",
        "speaker": "princess",
        "text": "It is the lock. Break it.",
        "expression": "commanding",
        "pose": "stepping-forward",
        "stage": "right",
        "background": "containment-antechamber-soft",
        "artState": "princess.commanding"
      },
      {
        "id": "floor.f10.upgrade.r02.b04",
        "speaker": "princess",
        "text": "Zephyr—when the lights go out, do not trust what welcomes you. Please. Be quicker than I was.",
        "expression": "lucid-strained",
        "pose": "clutching-head",
        "stage": "right",
        "background": "containment-antechamber-soft",
        "artState": "princess.lucid"
      },
      {
        "id": "floor.f10.upgrade.r02.b05",
        "speaker": "prince",
        "text": "Quicker than what? Stay. Tell me.",
        "expression": "alarmed",
        "pose": "reaching-forward",
        "stage": "left",
        "background": "containment-antechamber-soft",
        "artState": "prince.alarmed"
      },
      {
        "id": "floor.f10.upgrade.r02.b06",
        "speaker": "princess",
        "text": "Quicker than her next ward. Take the last gift. Bring me her silence.",
        "expression": "hijacked-calm",
        "pose": "hand-extended",
        "stage": "right",
        "background": "containment-antechamber-soft",
        "artState": "princess.possessive"
      },
      {
        "id": "floor.f10.upgrade.r02.b07",
        "speaker": "prince",
        "text": "I will end the fight. What waits after it will answer in its own voice.",
        "expression": "resolved",
        "pose": "lifting-scythe",
        "stage": "left",
        "background": "containment-antechamber-soft",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "boss.confrontation",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "bossConfrontation",
    "beats": [
      {
        "id": "boss.confrontation.b01",
        "speaker": "witch",
        "text": "You have mistaken the keeper for the prison from the first threshold. There is no useful warning left to soften.",
        "expression": "combat-ready",
        "pose": "staff-grounded",
        "stage": "right",
        "background": "containment-heart",
        "artState": "witch.combat"
      },
      {
        "id": "boss.confrontation.b02",
        "speaker": "prince",
        "text": "Then do not soften it. Release Elowen.",
        "expression": "exhausted-determined",
        "pose": "scythe-ready",
        "stage": "left",
        "background": "containment-heart",
        "artState": "prince.injured"
      },
      {
        "id": "boss.confrontation.b03",
        "speaker": "witch",
        "text": "Her release ends every ordered restraint you crossed. The forces that ignored those restraints will remain.",
        "expression": "clinical",
        "pose": "ward-forming",
        "stage": "right",
        "background": "containment-heart",
        "artState": "witch.clinical"
      },
      {
        "id": "boss.confrontation.b04",
        "speaker": "prince",
        "text": "You built a cage, filled it with dead guards, and ask me to admire the distinction.",
        "expression": "angry-contained",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "containment-heart",
        "artState": "prince.enraged"
      },
      {
        "id": "boss.confrontation.b05",
        "speaker": "witch",
        "text": "I ask you to survive recognizing it. The ring has made your judgment unusable because it carries truth and influence through the same channel.",
        "expression": "severe",
        "pose": "staff-raised",
        "stage": "right",
        "background": "containment-heart",
        "artState": "witch.warning"
      },
      {
        "id": "boss.confrontation.b06",
        "speaker": "prince",
        "text": "I heard her tell me to stop. She is still waiting behind whatever you have done.",
        "expression": "shaken",
        "pose": "gripping-ring",
        "stage": "left",
        "background": "containment-heart",
        "artState": "prince.doubtful"
      },
      {
        "id": "boss.confrontation.b07",
        "speaker": "witch",
        "text": "She is not waiting to be saved. A lucid breath is not a restored mind. Killing me will spend the last barrier between desire and consequence.",
        "expression": "grave",
        "pose": "ward-brightening",
        "stage": "right",
        "background": "containment-heart",
        "artState": "witch.clinical"
      },
      {
        "id": "boss.confrontation.b08",
        "speaker": "prince",
        "text": "Then she can tell me herself.",
        "expression": "absolute",
        "pose": "scythe-lifted",
        "stage": "left",
        "background": "containment-heart",
        "artState": "prince.resolved"
      },
      {
        "id": "boss.confrontation.b09",
        "speaker": "witch",
        "text": "Yes. That answer has always been the only one you would accept. Come, Prince. Learn what it costs.",
        "expression": "accepting",
        "pose": "battle-stance",
        "stage": "right",
        "background": "containment-heart",
        "artState": "witch.acceptance"
      },
      {
        "id": "boss.confrontation.b10",
        "speaker": "prince",
        "text": "I have paid in every room. I will not leave without seeing what the payment bought.",
        "expression": "final-commitment",
        "pose": "battle-stance",
        "stage": "left",
        "background": "containment-heart",
        "artState": "prince.resolved"
      }
    ]
  },
  {
    "id": "ending.witch-death",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "witchDeath",
    "beats": [
      {
        "id": "ending.witch-death.b01",
        "speaker": "prince",
        "text": "It is over. Open the way.",
        "expression": "exhausted",
        "pose": "scythe-lowered",
        "stage": "left",
        "background": "containment-heart-broken",
        "artState": "prince.injured"
      },
      {
        "id": "ending.witch-death.b02",
        "speaker": "witch",
        "text": "Yes. My part is over. The rest was never mine to end from here.",
        "expression": "wounded",
        "pose": "kneeling-with-staff",
        "stage": "right",
        "background": "containment-heart-broken",
        "artState": "witch.wounded"
      },
      {
        "id": "ending.witch-death.b03",
        "speaker": "prince",
        "text": "Elowen. Where is she?",
        "expression": "urgent",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "containment-heart-broken",
        "artState": "prince.alarmed"
      },
      {
        "id": "ending.witch-death.b04",
        "speaker": "witch",
        "text": "Beyond the last ward. When the ordered lights fail, watch what remains. Do not call survival cruelty merely because it arrives too late.",
        "expression": "final-acceptance",
        "pose": "releasing-staff",
        "stage": "right",
        "background": "containment-heart-broken",
        "artState": "witch.acceptance"
      },
      {
        "id": "ending.witch-death.b05",
        "speaker": "prince",
        "text": "You could have told me.",
        "expression": "conflicted",
        "pose": "looking-at-ward",
        "stage": "left",
        "background": "containment-heart-broken",
        "artState": "prince.doubtful"
      },
      {
        "id": "ending.witch-death.b06",
        "speaker": "witch",
        "text": "You required innocence from one of us. I had none to offer.",
        "expression": "fading",
        "pose": "eyes-closing",
        "stage": "right",
        "background": "containment-heart-broken",
        "artState": "witch.acceptance"
      },
      {
        "id": "ending.witch-death.b07",
        "speaker": "witch",
        "text": "Remember only this: when my lights vanish, their absence is not your victory. It is your evidence.",
        "expression": "final-acceptance",
        "pose": "final-speaking-kneel",
        "stage": "right",
        "background": "containment-heart-broken",
        "artState": "witch.acceptance"
      }
    ]
  },
  {
    "id": "ending.princess-reveal",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "princessReveal",
    "beats": [
      {
        "id": "ending.princess-reveal.b01",
        "speaker": "princess",
        "text": "You did it. Every ward dark, every careful hand gone. I felt the whole prison exhale.",
        "expression": "triumphant-corrupted",
        "pose": "arms-open",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.triumphant"
      },
      {
        "id": "ending.princess-reveal.b02",
        "speaker": "prince",
        "text": "Elowen? The lights died, but those things are still moving.",
        "expression": "horrified",
        "pose": "scythe-lowered",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.alarmed"
      },
      {
        "id": "ending.princess-reveal.b03",
        "speaker": "princess",
        "text": "Of course they are. Did you think her discipline made them all hers? Some appetites do not understand when a battle is finished.",
        "expression": "delighted-cold",
        "pose": "touching-ring",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.possessive"
      },
      {
        "id": "ending.princess-reveal.b04",
        "speaker": "prince",
        "text": "The rooms she did not control. The power around them. Your gifts.",
        "expression": "reeling",
        "pose": "looking-at-ring",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.doubtful"
      },
      {
        "id": "ending.princess-reveal.b05",
        "speaker": "princess",
        "text": "One current, carried so sweetly through our rings. I pulled; you named it longing. I pointed; you named it trust.",
        "expression": "possessive",
        "pose": "hand-extended",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.possessive"
      },
      {
        "id": "ending.princess-reveal.b06",
        "speaker": "prince",
        "text": "You sent me into them. You heard me bleed.",
        "expression": "devastated",
        "pose": "stepping-back",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.princess-reveal.b07",
        "speaker": "princess",
        "text": "And you kept coming. Love made you wonderfully easy to steer.",
        "expression": "intimate-cruel",
        "pose": "fingers-closing",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.possessive"
      },
      {
        "id": "ending.princess-reveal.b08",
        "speaker": "prince",
        "text": "The pull was never proof that you wanted rescue. It was only proof that something wanted me here.",
        "expression": "horrified",
        "pose": "tearing-ring-hand-away",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.alarmed"
      }
    ]
  },
  {
    "id": "ending.princess-human",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "princessHuman",
    "beats": [
      {
        "id": "ending.princess-human.b01",
        "speaker": "princess",
        "text": "No. Not that voice. Zephyr, listen before it takes the words again.",
        "expression": "lucid-horrified",
        "pose": "recoiling-from-ring",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.princess-human.b02",
        "speaker": "prince",
        "text": "I am here. Tell me what she did to you.",
        "expression": "desperate",
        "pose": "reaching-forward",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.princess-human.b03",
        "speaker": "princess",
        "text": "I did it. I could not accept that magic reached everywhere except the moment a mind was lost. I tried to hold one at the edge of death.",
        "expression": "ashamed",
        "pose": "hands-open",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.princess-human.b04",
        "speaker": "princess",
        "text": "It answered once. I called that mercy. Then proof. Then duty. Every name made it easier to continue.",
        "expression": "grief-stricken",
        "pose": "looking-at-hands",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.princess-human.b05",
        "speaker": "prince",
        "text": "What was it? What is speaking through you?",
        "expression": "shattered",
        "pose": "hand-falling",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.princess-human.b06",
        "speaker": "princess",
        "text": "Necromancy. Mine. The Witch was containing me, studying what I became before she ended it safely. I killed her through you.",
        "expression": "resolved",
        "pose": "meeting-his-gaze",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.princess-human.b07",
        "speaker": "prince",
        "text": "We can close the prison. Find another way.",
        "expression": "pleading",
        "pose": "stepping-forward",
        "stage": "left",
        "background": "prison-open-unstable",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.princess-human.b08",
        "speaker": "princess",
        "text": "There is no cure and no other way. I can feel it taking my hands. Kill me before I use them. Now.",
        "expression": "final-human-plea",
        "pose": "offering-heart",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.final-plea"
      },
      {
        "id": "ending.princess-human.b09",
        "speaker": "princess",
        "text": "Do not wait for a kinder answer. That is how I began. Five seconds, Zephyr. Save what I would not let go.",
        "expression": "fading-lucid",
        "pose": "holding-his-gaze",
        "stage": "right",
        "background": "prison-open-unstable",
        "artState": "princess.lucid"
      }
    ]
  },
  {
    "id": "ending.kill",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "endingKill",
    "beats": [
      {
        "id": "ending.kill.b01",
        "speaker": "prince",
        "text": "Forgive me.",
        "expression": "devastated",
        "pose": "catching-her",
        "stage": "left",
        "background": "prison-collapse-quiet",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.kill.b02",
        "speaker": "princess",
        "text": "No. Do not make forgiveness another burden you carry for me.",
        "expression": "lucid-pained",
        "pose": "held-upright",
        "stage": "right",
        "background": "prison-collapse-quiet",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.kill.b03",
        "speaker": "prince",
        "text": "I came to bring you home.",
        "expression": "breaking",
        "pose": "holding-her-hand",
        "stage": "left",
        "background": "prison-collapse-quiet",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.kill.b04",
        "speaker": "princess",
        "text": "You came because I pulled. You saved me when you finally stopped following.",
        "expression": "tender",
        "pose": "touching-his-ring",
        "stage": "right",
        "background": "prison-collapse-quiet",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.kill.b05",
        "speaker": "prince",
        "text": "I should have known you.",
        "expression": "grief-stricken",
        "pose": "forehead-to-hers",
        "stage": "left",
        "background": "prison-collapse-quiet",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.kill.b06",
        "speaker": "princess",
        "text": "You knew the part that loved you. I hid the part that believed love could forbid every leaving. That choice was mine.",
        "expression": "peaceful",
        "pose": "faint-smile",
        "stage": "right",
        "background": "prison-collapse-quiet",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.kill.b07",
        "speaker": "prince",
        "text": "Two taps. Come home.",
        "expression": "tearful-contained",
        "pose": "tapping-rings-twice",
        "stage": "left",
        "background": "prison-collapse-quiet",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.kill.b08",
        "speaker": "princess",
        "text": "I am here. Thank you, Zephyr. Close the page.",
        "expression": "fading-human",
        "pose": "closing-eyes",
        "stage": "right",
        "background": "prison-collapse-quiet",
        "artState": "princess.lucid"
      },
      {
        "id": "ending.kill.b09",
        "speaker": "prince",
        "text": "The page is closed. I will carry the words you left me, not the pull.",
        "expression": "alone",
        "pose": "holding-stilled-ring",
        "stage": "left",
        "background": "prison-collapse-quiet",
        "artState": "prince.devastated"
      }
    ]
  },
  {
    "id": "ending.timeout",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "endingTimeout",
    "beats": [
      {
        "id": "ending.timeout.b01",
        "speaker": "princess",
        "text": "There. I wondered whether she could make you do it.",
        "expression": "corrupted-return",
        "pose": "straightening",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      },
      {
        "id": "ending.timeout.b02",
        "speaker": "prince",
        "text": "Elowen, come back. You were here.",
        "expression": "desperate",
        "pose": "scythe-trembling",
        "stage": "left",
        "background": "prison-collapse-violent",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.timeout.b03",
        "speaker": "princess",
        "text": "She was clear. You heard every word. You simply waited for an answer that preserved you.",
        "expression": "amused-cold",
        "pose": "touching-wound",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      },
      {
        "id": "ending.timeout.b04",
        "speaker": "prince",
        "text": "The ring pulled me here. You made me believe—",
        "expression": "horrified",
        "pose": "gripping-ring",
        "stage": "left",
        "background": "prison-collapse-violent",
        "artState": "prince.alarmed"
      },
      {
        "id": "ending.timeout.b05",
        "speaker": "princess",
        "text": "I gave your belief a direction. You supplied the devotion, the excuses, and the blade.",
        "expression": "triumphant",
        "pose": "hand-closing",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      },
      {
        "id": "ending.timeout.b06",
        "speaker": "princess",
        "text": "Now give me the last thing you kept from me.",
        "expression": "predatory-calm",
        "pose": "striking-pose",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      },
      {
        "id": "ending.timeout.b07",
        "speaker": "prince",
        "text": "No. I know what you are now.",
        "expression": "final-defiance",
        "pose": "raising-scythe-too-late",
        "stage": "left",
        "background": "prison-collapse-violent",
        "artState": "prince.enraged"
      }
    ]
  },
  {
    "id": "ending.timeout-final",
    "presentation": "vn",
    "repeat": "oncePerRun",
    "sceneRole": "endingTimeoutFinal",
    "beats": [
      {
        "id": "ending.timeout-final.b01",
        "speaker": "prince",
        "text": "The Witch was keeping you here. You asked me to end it, and I freed it instead.",
        "expression": "dying-realization",
        "pose": "collapsed",
        "stage": "left",
        "background": "prison-collapse-violent",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.timeout-final.b02",
        "speaker": "princess",
        "text": "You wanted rescue more than you wanted her truth.",
        "expression": "intimate-cruel",
        "pose": "kneeling-over-him",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      },
      {
        "id": "ending.timeout-final.b03",
        "speaker": "prince",
        "text": "Elowen...",
        "expression": "devastated",
        "pose": "ring-hand-falling",
        "stage": "left",
        "background": "prison-collapse-violent",
        "artState": "prince.devastated"
      },
      {
        "id": "ending.timeout-final.b04",
        "speaker": "princess",
        "text": "No doors. No distance. Nothing between us now.",
        "expression": "final-corrupted",
        "pose": "touching-rings",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      },
      {
        "id": "ending.timeout-final.b05",
        "speaker": "princess",
        "text": "You always wanted that promise to be simple.",
        "expression": "triumphant-still",
        "pose": "closing-his-eyes",
        "stage": "right",
        "background": "prison-collapse-violent",
        "artState": "princess.full"
      }
    ]
  }
];

const sequenceIds = new Set();
const beatIds = new Set();
for (const sequence of entries) {
  if (sequenceIds.has(sequence.id)) throw new Error("Duplicate narrative sequence ID: " + sequence.id);
  sequenceIds.add(sequence.id);
  if (sequence.presentation !== "vn") throw new Error("Narrative sequence is not VN presentation: " + sequence.id);
  if (!sequence.sceneRole) throw new Error("Narrative sequence has no scene role: " + sequence.id);
  for (const beat of sequence.beats) {
    if (beatIds.has(beat.id)) throw new Error("Duplicate narrative beat ID: " + beat.id);
    beatIds.add(beat.id);
    const character = CHARACTERS[beat.speaker];
    if (!character) throw new Error("Unknown dialogue speaker: " + beat.speaker);
    if (!character.allowedStages.includes(beat.stage)) {
      throw new Error("Invalid stage " + beat.stage + " for " + beat.id);
    }
    const artAsset = characterArtAsset(beat.artState);
    if (artAsset.characterId !== beat.speaker) {
      throw new Error("Character art state does not match speaker for " + beat.id);
    }
    narrativeBackgroundAsset(beat.background);
  }
}

export const NARRATIVE_SEQUENCES = deepFreeze(
  Object.fromEntries(entries.map((entry) => [entry.id, entry])),
);
