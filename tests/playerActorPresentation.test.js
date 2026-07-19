import assert from "node:assert/strict";
import test from "node:test";
import { NARRATIVE_TIMING, PLAYER_CONFIG, SCYTHE_ATTACKS } from "../src/game/gameConfig.js";
import {
  PLAYER_ACTOR_PRESENTATION_TIMING,
  PlayerActorPresentation,
} from "../src/rendering/playerActorPresentation.js";

function game(overrides = {}) {
  const base = {
    phase: "playing",
    endingPresentationStage: "inactive",
    endingStrike: null,
    flags: { princeKilledByPrincess: false },
    player: {
      aimAngle: 0,
      position: { x: 1, z: 1 },
      previousPosition: { x: 1, z: 1 },
    },
    combat: {
      attack: null,
      attackTime: 0,
      attackKind: null,
      comboIndex: -1,
      isDashing: false,
      dashElapsed: 0,
      chargingHeavy: false,
      heavyCharge: 0,
    },
  };
  return {
    ...base,
    ...overrides,
    flags: { ...base.flags, ...overrides.flags },
    player: { ...base.player, ...overrides.player },
    combat: { ...base.combat, ...overrides.combat },
  };
}

function attackGame(index, time) {
  return game({
    combat: {
      attack: SCYTHE_ATTACKS[index],
      attackTime: time,
      attackKind: "light",
      comboIndex: index,
    },
  });
}

test("all three combo actions have distinct synchronized body silhouettes", () => {
  const presentation = new PlayerActorPresentation();
  const samples = SCYTHE_ATTACKS.map((attack, index) => presentation.sample(
    attackGame(index, (attack.activeStart + attack.activeEnd) / 2),
  ));

  assert.deepEqual(samples.map((sample) => sample.state), [
    "combo-1-active",
    "combo-2-active",
    "combo-3-active",
  ]);
  assert.notDeepEqual(samples[0].bones.spine, samples[1].bones.spine);
  assert.notDeepEqual(samples[1].bones.spine, samples[2].bones.spine);
  assert.notDeepEqual(samples[0].bones["upperarm.r"], samples[2].bones["upperarm.r"]);
  assert.equal(samples[1].clip, "2H_Melee_Attack_Spin");
  assert.equal(samples[2].clip, "2H_Melee_Attack_Spinning");
  assert.equal(samples.every((sample) => Object.isFrozen(sample) && Object.isFrozen(sample.bones)), true);
});

test("attack phases remain locked to each combat definition's active interval", () => {
  const presentation = new PlayerActorPresentation();
  for (const [index, attack] of SCYTHE_ATTACKS.entries()) {
    assert.match(presentation.sample(attackGame(index, attack.activeStart - 0.001)).state, /windup$/);
    assert.match(presentation.sample(attackGame(index, attack.activeStart)).state, /active$/);
    assert.match(presentation.sample(attackGame(index, attack.activeEnd)).state, /active$/);
    assert.match(presentation.sample(attackGame(index, attack.activeEnd + 0.001)).state, /recovery$/);
  }
});

test("dash strike owns the body while dash traversal remains active", () => {
  const presentation = new PlayerActorPresentation();
  const dashStrike = presentation.sample(game({
    combat: {
      attack: {
        name: "Reaping Passage",
        duration: 0.28,
        activeStart: 0.025,
        activeEnd: 0.2,
      },
      attackTime: 0.1,
      attackKind: "dash",
      comboIndex: -1,
      isDashing: true,
      dashElapsed: 0.08,
    },
  }));

  assert.equal(dashStrike.state, "dash-strike-active");
  assert.equal(dashStrike.clip, "Dodge_Forward");
  assert.ok(dashStrike.bones.spine.x < -0.2);
});

test("dash has authored start, travel, and recovery phases with deterministic clip seeking", () => {
  const presentation = new PlayerActorPresentation();
  const at = (ratio) => presentation.sample(game({
    combat: { isDashing: true, dashElapsed: PLAYER_CONFIG.dash.duration * ratio },
  }));

  const start = at(0.1);
  const travel = at(0.5);
  const recovery = at(0.9);
  assert.equal(start.state, "dash-start");
  assert.equal(travel.state, "dash-travel");
  assert.equal(recovery.state, "dash-recovery");
  assert.ok(start.clipProgress < travel.clipProgress);
  assert.ok(travel.clipProgress < recovery.clipProgress);
  assert.ok(Math.abs(travel.model.x) > Math.abs(start.model.x));
  assert.ok(Math.abs(travel.model.x) > Math.abs(recovery.model.x));
});

test("charge start, held loop, release quality, and body commitment are distinct", () => {
  const presentation = new PlayerActorPresentation();
  const charge = (value) => presentation.sample(game({
    combat: { chargingHeavy: true, heavyCharge: value },
  }), 1 / 60);
  assert.equal(charge(0.05).state, "charge-start");
  assert.equal(charge(0.4).state, "charge-loop");
  assert.equal(charge(0.82).state, "charge-ready");

  const partial = presentation.sample(game({
    combat: {
      attack: { duration: 0.72, activeStart: 0.2, activeEnd: 0.46, chargeQuality: "partial" },
      attackTime: 0.3,
      attackKind: "heavy",
    },
  }));
  const perfect = presentation.sample(game({
    combat: {
      attack: { duration: 0.72, activeStart: 0.2, activeEnd: 0.46, chargeQuality: "perfect" },
      attackTime: 0.3,
      attackKind: "heavy",
    },
  }));
  assert.equal(partial.state, "charged-reap-partial-active");
  assert.equal(perfect.state, "charged-reap-perfect-active");
  assert.ok(Math.abs(perfect.bones.spine.x) > Math.abs(partial.bones.spine.x));
});

test("directional hit reaction distinguishes side and severity and freezes with zero dt", () => {
  const presentation = new PlayerActorPresentation();
  presentation.handleEvent({
    type: "playerHit",
    detail: { severity: "heavy", direction: { x: 0, z: 1 } },
  });
  const first = presentation.sample(game(), 0.06);
  const frozen = presentation.sample(game(), 0);
  assert.equal(first.state, "hit-heavy-right");
  assert.equal(frozen.progress, first.progress);
  assert.ok(Math.abs(first.model.z) > 0);

  presentation.handleEvent({
    type: "playerHit",
    detail: { severity: "light", direction: { x: 0, z: -1 } },
  });
  const opposite = presentation.sample(game(), 0.06);
  assert.equal(opposite.state, "hit-light-left");
  assert.ok(Math.abs(first.model.x) > Math.abs(opposite.model.x));
});

test("healing and Death Defiance have actor-owned reactions with revive priority", () => {
  const presentation = new PlayerActorPresentation();
  presentation.handleEvent({ type: "playerHealed", detail: { amount: 12 } });
  const heal = presentation.sample(game(), 0.1);
  assert.equal(heal.state, "heal");
  assert.ok(heal.bones.chest.x < 0);

  presentation.handleEvent({
    type: "playerHit",
    detail: { severity: "heavy", direction: { x: 1, z: 0 } },
  });
  presentation.handleEvent({ type: "playerRevived", detail: { amount: 49 } });
  const collapse = presentation.sample(game(), 0.1);
  assert.equal(collapse.state, "revive-collapse");
  assert.equal(collapse.clip, "Death_A");
  const rise = presentation.sample(game(), PLAYER_ACTOR_PRESENTATION_TIMING.revive * 0.45);
  assert.equal(rise.state, "revive-rise");
  assert.equal(rise.clip, "Idle");
});

test("ending strike follows exact anticipation, travel, contact-recovery, and victory stages", () => {
  const presentation = new PlayerActorPresentation();
  const sampleAt = (elapsed) => presentation.sample(game({
    phase: "endingStrike",
    endingPresentationStage: "endingStrike",
    endingStrike: { elapsed, timing: NARRATIVE_TIMING.endingStrike },
  }));

  assert.equal(sampleAt(0).state, "ending-strike-anticipation");
  assert.equal(sampleAt(NARRATIVE_TIMING.endingStrike.T).state, "ending-strike-travel");
  assert.equal(sampleAt(NARRATIVE_TIMING.endingStrike.C - 0.001).state, "ending-strike-travel");
  assert.equal(sampleAt(NARRATIVE_TIMING.endingStrike.C).state, "ending-strike-recovery");
  assert.equal(sampleAt(NARRATIVE_TIMING.endingStrike.R).progress, 1);

  presentation.handleEvent({ type: "endingStrikeCompleted", detail: {} });
  assert.equal(presentation.sample(game({ endingPresentationStage: "kill" }), 0.1).state, "victory");
  assert.equal(
    presentation.sample(game({ endingPresentationStage: "complete" }), PLAYER_ACTOR_PRESENTATION_TIMING.victory).state,
    "aftermath",
  );
});

test("terminal death overrides all transient actions and run reset clears presentation state", () => {
  const presentation = new PlayerActorPresentation();
  presentation.handleEvent({ type: "playerHealed", detail: { amount: 20 } });
  assert.equal(presentation.sample(game({ phase: "dead" }), 0).state, "dead");
  presentation.handleEvent({ type: "runStarted", detail: {} });
  assert.equal(presentation.sample(game(), 0).state, "idle");
});

