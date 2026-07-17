export const MUSIC_BPM = 132;
export const BEATS_PER_BAR = 4;
export const STEPS_PER_BEAT = 2;
export const STEPS_PER_BAR = BEATS_PER_BAR * STEPS_PER_BEAT;
export const STEP_SECONDS = 60 / MUSIC_BPM / STEPS_PER_BEAT;
export const BAR_SECONDS = STEP_SECONDS * STEPS_PER_BAR;

const BIOME_ALIASES = Object.freeze({
  keep: "forgottenKeep",
  forgotten_keep: "forgottenKeep",
  forgottenkeep: "forgottenKeep",
  ossuary: "ossuary",
  ember: "emberFoundry",
  ember_foundry: "emberFoundry",
  emberfoundry: "emberFoundry",
  void: "voidCourt",
  void_court: "voidCourt",
  voidcourt: "voidCourt",
});

export const BIOME_PALETTES = Object.freeze({
  forgottenKeep: Object.freeze({
    tonic: 46,
    scale: Object.freeze([0, 2, 3, 5, 7, 8, 10]),
    progression: Object.freeze([0, 5, 3, 6]),
    melody: Object.freeze([4, 2, 5, 3, 6, 4, 2, 1]),
    brightness: 0.48,
    pulse: "stone",
  }),
  ossuary: Object.freeze({
    tonic: 48,
    scale: Object.freeze([0, 1, 3, 5, 7, 8, 10]),
    progression: Object.freeze([0, 3, 1, 6]),
    melody: Object.freeze([4, 1, 5, 2, 6, 3, 1, 0]),
    brightness: 0.35,
    pulse: "bone",
  }),
  emberFoundry: Object.freeze({
    tonic: 43,
    scale: Object.freeze([0, 2, 3, 6, 7, 9, 10]),
    progression: Object.freeze([0, 3, 6, 4]),
    melody: Object.freeze([4, 5, 3, 6, 4, 2, 5, 1]),
    brightness: 0.72,
    pulse: "forge",
  }),
  voidCourt: Object.freeze({
    tonic: 41,
    scale: Object.freeze([0, 1, 4, 5, 7, 8, 11]),
    progression: Object.freeze([0, 4, 1, 6]),
    melody: Object.freeze([6, 3, 5, 2, 4, 1, 6, 0]),
    brightness: 0.28,
    pulse: "void",
  }),
});

export const MUSIC_STATES = Object.freeze({
  exploration: Object.freeze({
    lute: 0.72,
    dulcimer: 0.32,
    strings: 0.42,
    flute: 0.38,
    bass: 0.34,
    percussion: 0.24,
    horns: 0,
    bells: 0.22,
    choir: 0.1,
  }),
  combat: Object.freeze({
    lute: 0.82,
    dulcimer: 0.7,
    strings: 0.62,
    flute: 0.58,
    bass: 0.78,
    percussion: 0.86,
    horns: 0.44,
    bells: 0.36,
    choir: 0.3,
  }),
  boss: Object.freeze({
    lute: 0.9,
    dulcimer: 0.86,
    strings: 0.82,
    flute: 0.52,
    bass: 0.95,
    percussion: 1,
    horns: 0.92,
    bells: 0.52,
    choir: 0.78,
  }),
});

export function normalizeBiome(value) {
  const raw = typeof value === "object" ? value?.id ?? value?.name : value;
  if (!raw) return "forgottenKeep";
  const compact = String(raw).replace(/[\s-]/g, "_").toLowerCase();
  return BIOME_ALIASES[compact] ?? (BIOME_PALETTES[raw] ? raw : "forgottenKeep");
}

export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function scaleFrequency(palette, degree, octaveOffset = 0) {
  const scaleLength = palette.scale.length;
  const wrappedDegree = ((degree % scaleLength) + scaleLength) % scaleLength;
  const octave = Math.floor(degree / scaleLength) + octaveOffset;
  return midiToFrequency(palette.tonic + palette.scale[wrappedDegree] + octave * 12);
}

export function layerMix(state, intensity = 1, dynamic = true) {
  const arrangement = MUSIC_STATES[dynamic ? state : "combat"] ?? MUSIC_STATES.exploration;
  const density = 0.35 + Math.min(1, Math.max(0, intensity)) * 0.65;
  return Object.fromEntries(Object.entries(arrangement).map(([layer, value]) => [layer, value * density]));
}
