import { BLESSINGS } from "./blessings.js";
import {
  getPlayerModifierRank,
  getProgressionRank,
  resolveModifierRankTotal,
} from "./progressionModel.js";

const DEFINITIONS = BLESSINGS;
const DEFINITION_BY_ID = new Map(DEFINITIONS.map((definition) => [definition.id, definition]));
const MODIFIER_BY_ID = new Map();

for (const definition of DEFINITIONS) {
  for (const modifier of definition.modifiers) {
    MODIFIER_BY_ID.set(modifier.id, Object.freeze({ definition, modifier }));
  }
}

export function modifierRank(player, modifierId) {
  return getPlayerModifierRank(player, modifierId);
}

export function modifierTotal(player, modifierId) {
  const entry = MODIFIER_BY_ID.get(modifierId);
  if (!entry) return null;
  return resolveModifierRankTotal(entry.modifier, modifierRank(player, modifierId));
}

export function progressionDefinition(id) {
  return DEFINITION_BY_ID.get(id) ?? null;
}

function ownedSnapshot(definition, ranks) {
  const rank = getProgressionRank(ranks, definition.id);
  if (rank <= 0) return null;
  return Object.freeze({
    id: definition.id,
    name: definition.name,
    path: definition.path,
    techniqueSlot: definition.techniqueSlot ?? null,
    rank,
    maxRank: Number.isFinite(definition.maxRank) ? definition.maxRank : null,
  });
}

export function progressionBuildSnapshot(ranks) {
  const oaths = BLESSINGS.map((definition) => ownedSnapshot(definition, ranks)).filter(Boolean);
  const oathSlots = {};
  for (const oath of oaths) oathSlots[oath.techniqueSlot] = oath;
  return Object.freeze({
    oaths: Object.freeze(oaths),
    oathSlots: Object.freeze(oathSlots),
  });
}

export function progressionConditionsSnapshot(state, player) {
  return Object.freeze({
    aegis: Object.freeze({
      ready: state.aegisRemaining > 0,
      value: state.aegisReduction,
      seconds: Math.max(0, state.aegisRemaining),
    }),
    guaranteedCritical: Object.freeze({ ready: state.guaranteedCriticalReady }),
  });
}

export function comboProfile(player, comboIndex) {
  const headsman = modifierTotal(player, "headsmansCadence");
  const ghost = modifierTotal(player, "ghostCadence");
  const pallbearer = modifierTotal(player, "pallbearersCadence");
  let damageMultiplier = 1;
  let poiseMultiplier = 1;
  if (comboIndex === 2) {
    damageMultiplier *= 1 + (headsman?.finisherDamageBonus ?? 0);
    poiseMultiplier *= 1 + (pallbearer?.finisherPoiseBonus ?? 0);
  } else {
    damageMultiplier *= 1 - (headsman?.openingHitDamagePenalty ?? 0);
    damageMultiplier *= 1 - (pallbearer?.openingHitDamagePenalty ?? 0);
  }
  damageMultiplier *= 1 - (ghost?.damagePenalty ?? 0);
  return Object.freeze({
    damageMultiplier,
    poiseMultiplier,
    reachMultiplier: 1 - (ghost?.reachPenalty ?? 0),
    timingMultiplier: 1 - (ghost?.timingReduction ?? 0),
  });
}

export function chargedReapProfile(player, quality) {
  const falling = modifierTotal(player, "fallingMoon");
  const quick = modifierTotal(player, "quickOrbit");
  const blood = modifierTotal(player, "bloodOrbit");
  const perfect = quality === "perfect";
  return Object.freeze({
    damageMultiplier: (1 + (perfect ? falling?.perfectDamageBonus ?? 0 : 0))
      * (1 + (blood?.damageBonus ?? 0))
      * (1 - (quick?.damagePenalty ?? 0)),
    poiseMultiplier: (1 + (perfect ? falling?.perfectPoiseBonus ?? 0 : 0))
      * (1 - (quick?.poisePenalty ?? 0)),
    timingMultiplier: 1 - (quick?.timingReduction ?? 0),
    recoveryMultiplier: 1 - (quick?.recoveryReduction ?? 0),
    cooldownMultiplier: 1 - (quick?.cooldownReduction ?? 0),
    perfectWindowSeconds: falling?.perfectWindowSeconds ?? null,
    healthCost: blood?.healthCost ?? 0,
    healPerEnemy: blood?.healPerEnemy ?? 0,
    healCap: blood?.healCap ?? 0,
  });
}

export function graveLineProfile(player) {
  const needle = modifierTotal(player, "needlemoon");
  const flash = modifierTotal(player, "flashFurrow");
  const funeral = modifierTotal(player, "funeralFurrow");
  return Object.freeze({
    damageMultiplier: (1 + (needle?.damageBonus ?? 0))
      * (1 - (flash?.damagePenalty ?? 0))
      * (1 - (funeral?.damagePenalty ?? 0)),
    poiseMultiplier: 1 + (needle?.poiseBonus ?? 0),
    widthMultiplier: (1 - (needle?.widthPenalty ?? 0))
      * (1 - (flash?.widthPenalty ?? 0))
      * (1 + (funeral?.widthBonus ?? 0)),
    buildupMultiplier: 1 - (flash?.buildupReduction ?? 0),
    recoveryMultiplier: 1 - (flash?.recoveryReduction ?? 0),
    pullEnabled: funeral?.pullEnabled === true,
    slow: funeral?.slow ?? 0,
    slowDurationSeconds: funeral?.slowDurationSeconds ?? 0,
  });
}

export function claimConfigOverrides(player, base) {
  const guillotine = modifierTotal(player, "guillotineReturn");
  const phantom = modifierTotal(player, "phantomCircuit");
  const gravebind = modifierTotal(player, "gravebind");
  const speed = 1 + (phantom?.travelSpeedBonus ?? 0);
  return Object.freeze({
    empoweredWindow: base.empoweredWindow * (1 - (guillotine?.catchWindowPenalty ?? 0)),
    outbound: Object.freeze({
      duration: base.outbound.duration / speed,
      releaseAt: base.outbound.releaseAt / speed,
      damage: base.outbound.damage * (1 - (guillotine?.outboundDamagePenalty ?? 0)),
    }),
    recall: Object.freeze({
      duration: base.recall.duration / speed,
      radius: base.recall.radius * (1 + (gravebind?.recallRadiusBonus ?? 0)),
      damage: base.recall.damage * (1 + (guillotine?.recallDamageBonus ?? 0))
        * (1 - (gravebind?.recallDamagePenalty ?? 0)),
      poiseDamage: base.recall.poiseDamage,
      pullStrength: base.recall.pullStrength * (1 + (gravebind?.recallPullBonus ?? 0)),
    }),
    empoweredCleave: Object.freeze({
      radius: base.empoweredCleave.radius * (1 - (phantom?.catchRadiusPenalty ?? 0)),
      damage: base.empoweredCleave.damage * (1 + (guillotine?.catchDamageBonus ?? 0))
        * (1 - (phantom?.catchDamagePenalty ?? 0))
        * (1 - (gravebind?.catchDamagePenalty ?? 0)),
      poiseDamage: base.empoweredCleave.poiseDamage,
    }),
  });
}

export function dashProfile(player) {
  const passage = modifierTotal(player, "reapingPassageOath");
  const eclipse = modifierTotal(player, "perfectEclipse");
  const graveStep = modifierTotal(player, "graveStep");
  return Object.freeze({
    cooldownMultiplier: 1 + (passage?.dashCooldownPenalty ?? 0),
    distanceMultiplier: 1 - (graveStep?.dashDistancePenalty ?? 0),
    perfectWindowSeconds: eclipse?.perfectWindowSeconds ?? null,
    invulnerabilitySeconds: eclipse?.invulnerabilitySeconds ?? null,
  });
}
