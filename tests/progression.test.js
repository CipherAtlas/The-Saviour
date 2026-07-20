import assert from "node:assert/strict";
import test from "node:test";
import { Game } from "../src/game/Game.js";
import { BLESSINGS, BLESSING_FALLBACK } from "../src/game/blessings.js";
import {
  applyRunUpgrade,
  CHAMBER_FALLBACK,
  isUpgradeEligible,
  offerUpgradeChoices,
  RUN_UPGRADES,
} from "../src/game/runUpgrades.js";
import { DEATH_DEFIANCE_GRANT_CAP, PORTAL_CONFIG, RUN_CONFIG } from "../src/game/gameConfig.js";
import { defineProgressionCard } from "../src/game/progressionModel.js";
import { SeededRandom } from "../src/generation/seededRandom.js";

function createInput() {
  return {
    settings: { get: () => "hold" },
    movement: () => ({ x: 0, y: 0 }),
    isDown: () => false,
    consume: () => false,
  };
}

function createSettings() {
  const values = { "gameplay.difficulty": "standard", "gameplay.autoTarget": 0, "gameplay.aimAssist": 0 };
  return { get: (path) => values[path] };
}

function startGame(seed) {
  const game = new Game(createInput(), createSettings());
  game.startRun(seed);
  while (game.phase === "bookend") game.continueBookend();
  return game;
}

function completeBookend(game) {
  while (game.phase === "bookend") game.continueBookend();
}

function choiceSummary(choices) {
  return choices.map(({ id, path, rank, nextRank, maxRank }) => ({ id, path, rank, nextRank, maxRank }));
}

function assertCompleteCardSnapshot(card, tier) {
  assert.deepEqual(Object.keys(card), [
    "id", "name", "description", "path", "tier", "rank", "nextRank", "maxRank", "fallback",
    "tags", "prerequisites", "excludes", "synergies", "effects", "transformation",
    "deathDefianceGrant", "preview",
  ]);
  assert.equal(card.tier, tier);
  assert.equal(Object.isFrozen(card), true);
  for (const field of ["tags", "prerequisites", "excludes", "synergies", "effects"]) {
    assert.equal(Object.isFrozen(card[field]), true, field);
  }
  assert.equal(Object.isFrozen(card.preview), true);
  assert.equal(Object.isFrozen(card.preview.rows), true);
  assert.ok(card.preview.rows.length > 0);
  assert.ok(card.preview.rows.every((row) => Object.isFrozen(row)));
}

function previewPlayer() {
  return {
    health: 91,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    healthOnKill: 0,
    roomRecoveryBonus: 0,
    deathDefiance: 0,
    deathDefianceGranted: 0,
    transformationRanks: {},
  };
}

function syntheticDeathDefiance(id) {
  return defineProgressionCard({
    id,
    path: "Grave",
    tier: "blessing",
    name: id,
    description: "Test grant.",
    maxRank: 1,
    fallback: false,
    prerequisites: [],
    excludes: [],
    tags: ["death-defiance"],
    synergies: [],
    effects: [{ stat: "deathDefiance", operation: "grant", value: 1, unit: "charge", perRank: false }],
    transformation: null,
    deathDefianceGrant: "activation",
  });
}

test("chamber offers are deterministic, unique, and span all three paths", () => {
  const ranks = new Map();
  const first = offerUpgradeChoices(new SeededRandom("REWARD-SEED"), ranks);
  const second = offerUpgradeChoices(new SeededRandom("REWARD-SEED"), ranks);

  assert.deepEqual(choiceSummary(first), choiceSummary(second));
  assert.equal(new Set(first.map((choice) => choice.id)).size, 3);
  assert.deepEqual(new Set(first.map((choice) => choice.path)), new Set(["Reaper", "Shade", "Grave"]));
  assert.ok(first.every((choice) => choice.rank === 0 && choice.nextRank === 1));
});

test("rank caps, mutual exclusions, and exhaustion fallback are enforced", () => {
  const player = {
    health: 100,
    maxHealth: 140,
    damageMultiplier: 1,
    reachMultiplier: 1,
    dashCooldownMultiplier: 1,
    criticalChance: 0.05,
    healthOnKill: 0,
    roomRecoveryBonus: 0,
  };
  const ranks = new Map();
  const merciless = RUN_UPGRADES.find((upgrade) => upgrade.id === "merciless-arc");
  const graveOath = RUN_UPGRADES.find((upgrade) => upgrade.id === "grave-oath");

  assert.equal(applyRunUpgrade(merciless, player, ranks).rank, 1);
  assert.equal(applyRunUpgrade(merciless, player, ranks), null);
  assert.equal(isUpgradeEligible(graveOath, ranks), false);

  const capped = new Map(RUN_UPGRADES.map((upgrade) => [upgrade.id, upgrade.maxRank]));
  const choices = offerUpgradeChoices(new SeededRandom("EXHAUSTED"), capped);
  assert.deepEqual(choices.map((choice) => choice.id), [CHAMBER_FALLBACK.id]);
});

test("Game offer events expose complete frozen chamber and blessing card snapshots", () => {
  const game = new Game(createInput(), createSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.rng = new SeededRandom("CARD-SNAPSHOT");
  game.player = previewPlayer();
  game.floor = 1;
  game.room = 1;
  game.roomClearResolved = true;
  game.portalTraversal = { completed: true };

  game.offerRoomReward();
  assert.equal(game.phase, "reward");
  const chamberChoices = events.find((event) => event.type === "roomRewardOffered").detail.choices;
  assert.equal(Object.isFrozen(chamberChoices), true);
  const chamber = chamberChoices[0];
  assertCompleteCardSnapshot(chamber, "chamber");
  assert.deepEqual(chamber.preview, game.pendingRoomRewards[0].preview);

  game.pendingRoomRewards = [];
  game.roomRewardPending = false;
  game.room = RUN_CONFIG.roomsPerFloor;
  game.advanceRoom();
  assert.equal(game.phase, "blessing");
  const blessingChoices = events.find((event) => event.type === "blessingOffered").detail.choices;
  assert.equal(Object.isFrozen(blessingChoices), true);
  const blessing = blessingChoices[0];
  assertCompleteCardSnapshot(blessing, "blessing");
  assert.deepEqual(blessing.preview, game.pendingBlessings[0].preview);
});

test("pending waves delay portal opening and portal entry gates the reward phase", () => {
  const game = startGame("NO-EARLY-CLEAR");
  for (const enemy of game.director.enemies) enemy.active = false;
  game.director.pendingWaves = [{ index: 1, delay: 0.5, entries: [] }];

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.portalActive, false);
  assert.equal(game.phase, "playing");
  assert.equal(game.pendingRoomRewards.length, 0);

  game.director.pendingWaves = [];
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.portalActive, true);
  assert.equal(game.phase, "playing");
  assert.equal(game.activeBookend, null);
  assert.equal(game.pendingRoomRewards.length, 0);

  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
  assert.equal(game.phase, "reward");
  assert.equal(game.pendingRoomRewards.length, 3);
});

test("chambers one and two grant a ranked reward only after portal entry", () => {
  const game = startGame("CHAMBER-REWARD");
  const events = [];
  game.on((event) => events.push(event));
  game.director.enemies.length = 0;
  game.director.pendingWaves.length = 0;

  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);
  assert.equal(game.phase, "playing");
  assert.equal(game.portalActive, true);
  assert.equal(events.some((event) => event.type === "roomRewardOffered"), false);
  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
  assert.equal(game.phase, "reward");
  assert.equal(game.portalActive, false);
  const choice = game.pendingRoomRewards[0];
  const offeredCard = events.find((event) => event.type === "roomRewardOffered").detail.choices[0];
  assertCompleteCardSnapshot(offeredCard, "chamber");
  assert.deepEqual(offeredCard.preview, choice.preview);
  game.chooseRoomReward(choice.id);

  assert.equal(game.phase, "playing");
  assert.equal(game.room, 2);
  assert.equal(game.portalActive, false);
  assert.equal(game.upgradeRanks.get(choice.id), 1);
  assert.ok(events.some((event) => event.type === "roomRewardOffered"));
  assert.ok(events.some((event) => event.type === "roomRewardChosen" && event.detail.rank === 1));
  assert.ok(events.some((event) => event.type === "portalOpened"));
  assert.ok(
    events.findIndex((event) => event.type === "portalOpened") <
    events.findIndex((event) => event.type === "roomRewardOffered"),
  );
});

test("third chambers retain the major blessing transition before the next floor", () => {
  const game = startGame("MAJOR-BLESSING");
  const events = [];
  game.on((event) => events.push(event));
  game.room = RUN_CONFIG.roomsPerFloor;
  game.loadRoom();
  game.director.enemies.length = 0;
  game.director.pendingWaves.length = 0;
  game.checkRoomProgress(RUN_CONFIG.roomClearDelay);

  assert.equal(game.phase, "playing");
  assert.equal(game.pendingRoomRewards.length, 0);
  assert.equal(game.portalActive, true);
  assert.equal(game.beginPortalTraversal(), true);
  game.updatePortalTraversal(PORTAL_CONFIG.traversalDuration);
  assert.equal(game.phase, "blessing");
  assert.equal(game.pendingBlessings.length, 3);

  const choice = game.pendingBlessings[0];
  const offeredCard = events.find((event) => event.type === "blessingOffered").detail.choices[0];
  assertCompleteCardSnapshot(offeredCard, "blessing");
  assert.deepEqual(offeredCard.preview, choice.preview);
  game.chooseBlessing(choice.id);
  assert.equal(game.floor, 2);
  assert.equal(game.room, 1);
  assert.equal(game.upgradeRanks.get(choice.id), 1);
});

test("boss showcase enters the final arena in a playable invulnerable state", () => {
  const game = new Game(createInput(), createSettings());
  const events = [];
  game.on((event) => events.push(event));

  game.enterBossShowcase("QA-BOSS");

  assert.equal(game.showcaseMode, "boss");
  assert.equal(game.floor, RUN_CONFIG.totalFloors);
  assert.equal(game.room, RUN_CONFIG.roomsPerFloor);
  assert.equal(game.arena.boss, true);
  assert.equal(game.phase, "playing");
  assert.equal(game.player.invulnerable, Number.POSITIVE_INFINITY);
  assert.equal(game.director.activeBoss()?.bossPhase, 1);
  assert.equal(game.bookend.current, null);
  assert.ok(events.some((event) => event.type === "showcaseStarted" && event.detail.mode === "boss"));

  game.startRun("NORMAL-ROUTE");
  assert.equal(game.showcaseMode, null);
  assert.equal(game.floor, 1);
  assert.equal(game.room, 1);
  assert.equal(game.phase, "bookend");
});

test("reward showcase exposes a deterministic real chamber offer without choosing it", () => {
  const first = new Game(createInput(), createSettings());
  const second = new Game(createInput(), createSettings());

  first.enterRewardShowcase("QA-REWARD");
  second.enterRewardShowcase("QA-REWARD");

  assert.equal(first.showcaseMode, "reward");
  assert.equal(first.phase, "reward");
  assert.equal(first.portalActive, false);
  assert.equal(first.roomRewardPending, true);
  assert.equal(first.director.hasCombatRemaining(), false);
  assert.equal(first.bookend.current, null);
  assert.equal(first.pendingRoomRewards.length, 3);
  assert.deepEqual(new Set(first.pendingRoomRewards.map((choice) => choice.path)), new Set(["Reaper", "Shade", "Grave"]));
  assert.deepEqual(choiceSummary(first.pendingRoomRewards), choiceSummary(second.pendingRoomRewards));
});

test("one isolated deterministic reroll is shared by every offer on a floor", () => {
  const first = new Game(createInput(), createSettings());
  const second = new Game(createInput(), createSettings());
  const events = [];
  first.on((event) => events.push(event));
  first.enterRewardShowcase("QA-REROLL");
  second.enterRewardShowcase("QA-REROLL");
  const firstInitial = first.pendingRoomRewards.map(({ id }) => id);
  const secondInitial = second.pendingRoomRewards.map(({ id }) => id);
  const rngState = first.rng.state;

  assert.equal(first.rerollUpgradeOffer(), true);
  assert.equal(second.rerollUpgradeOffer(), true);
  assert.equal(first.rng.state, rngState);
  assert.deepEqual(firstInitial, secondInitial);
  assert.deepEqual(first.pendingRoomRewards.map(({ id }) => id), second.pendingRoomRewards.map(({ id }) => id));
  assert.ok(first.pendingRoomRewards.some(({ id }) => !firstInitial.includes(id)));
  assert.deepEqual(new Set(first.pendingRoomRewards.map(({ path }) => path)), new Set(["Reaper", "Shade", "Grave"]));
  assert.equal(first.rerollsUsedByFloor[0], 1);
  assert.equal(first.rerollUpgradeOffer(), false);

  const rerolled = events.find((event) => event.type === "upgradeRerolled")?.detail;
  assert.equal(Object.isFrozen(rerolled), true);
  assert.equal(Object.isFrozen(rerolled.choices), true);
  assert.equal(rerolled.tier, "chamber");
  assert.equal(rerolled.rerollAvailable, false);

  first.phase = "blessing";
  first.pendingBlessings = [BLESSINGS[0], BLESSINGS[3], BLESSINGS[6]];
  assert.equal(first.rerollUpgradeOffer(), false);
  first.floor = 2;
  assert.equal(first.rerollAvailableFor(first.pendingBlessings, BLESSINGS), true);
});

test("an unused floor reroll can be spent on blessings and identical fallback offers do not consume it", () => {
  const game = new Game(createInput(), createSettings());
  const events = [];
  game.on((event) => events.push(event));
  game.startRun("BLESSING-REROLL");
  completeBookend(game);
  game.phase = "blessing";
  game.pendingBlessings = [BLESSINGS[0], BLESSINGS[3], BLESSINGS[6]]
    .map((choice) => ({ ...choice, rank: 0, nextRank: 1, preview: null }));
  assert.equal(game.rerollUpgradeOffer(), true);
  assert.equal(game.rerollsUsedByFloor[0], 1);
  assert.equal(events.filter((event) => event.type === "upgradeRerolled").length, 1);

  const fallbackGame = new Game(createInput(), createSettings());
  fallbackGame.startRun("FALLBACK-REROLL");
  completeBookend(fallbackGame);
  fallbackGame.phase = "blessing";
  fallbackGame.pendingBlessings = [BLESSING_FALLBACK];
  assert.equal(fallbackGame.rerollUpgradeOffer(), false);
  assert.equal(fallbackGame.rerollsUsedByFloor[0], 0);
});

test("Death Defiance lifetime grants are atomic and capped separately from remaining charges", () => {
  const player = previewPlayer();
  const ranks = new Map();
  const first = syntheticDeathDefiance("test-mercy-one");
  const second = syntheticDeathDefiance("test-mercy-two");
  const third = syntheticDeathDefiance("test-mercy-three");

  assert.equal(DEATH_DEFIANCE_GRANT_CAP, 2);
  assert.equal(applyRunUpgrade(first, player, ranks).deathDefianceGrantedTotal, 1);
  assert.deepEqual({ granted: player.deathDefianceGranted, remaining: player.deathDefiance }, { granted: 1, remaining: 1 });
  player.deathDefiance = 0;
  assert.equal(applyRunUpgrade(second, player, ranks).deathDefianceGrantedTotal, 2);
  assert.deepEqual({ granted: player.deathDefianceGranted, remaining: player.deathDefiance }, { granted: 2, remaining: 1 });
  player.deathDefiance = 0;

  const before = structuredClone(player);
  assert.equal(isUpgradeEligible(third, ranks, player), false);
  assert.equal(applyRunUpgrade(third, player, ranks), null);
  assert.deepEqual(player, before);
  assert.equal(ranks.has(third.id), false);
  assert.deepEqual(
    offerUpgradeChoices(new SeededRandom("DD-CAP"), ranks, [third], 1, BLESSING_FALLBACK, player).map(({ id }) => id),
    [BLESSING_FALLBACK.id],
  );
});

test("accepted Death Defiance grants and revivals publish separate immutable lifetime totals", () => {
  const game = startGame("DD-EVENTS");
  const events = [];
  game.on((event) => events.push(event));
  const finalMercy = BLESSINGS.find(({ id }) => id === "final-mercy");
  game.phase = "blessing";
  game.room = RUN_CONFIG.roomsPerFloor;
  game.pendingBlessings = [finalMercy];
  game.chooseBlessing(finalMercy.id);

  const granted = events.find((event) => event.type === "deathDefianceGranted")?.detail;
  assert.deepEqual(
    { amount: granted.amount, grantedTotal: granted.grantedTotal, chargesRemaining: granted.chargesRemaining, upgradeId: granted.upgradeId },
    { amount: 1, grantedTotal: 1, chargesRemaining: 1, upgradeId: "final-mercy" },
  );
  assert.equal(Object.isFrozen(granted), true);

  completeBookend(game);
  game.phase = "playing";
  game.player.health = 1;
  game.player.invulnerable = 0;
  game.damagePlayer(10, "dd-event-test");
  const revived = events.find((event) => event.type === "playerRevived")?.detail;
  assert.equal(game.player.deathDefianceGranted, 1);
  assert.equal(game.player.deathDefiance, 0);
  assert.equal(revived.grantedTotal, 1);
  assert.equal(revived.chargesRemaining, 0);
  assert.equal(Object.isFrozen(revived), true);
});

test("the fixed update resolves player movement exactly once", () => {
  const game = startGame("MOVEMENT-RESOLUTION");
  const resolveMovement = game.combat.resolveMovement.bind(game.combat);
  let resolveCalls = 0;
  game.combat.resolveMovement = (movementResult) => {
    resolveCalls += 1;
    resolveMovement(movementResult);
  };

  game.updateFixed(RUN_CONFIG.fixedStep);

  assert.equal(resolveCalls, 1);
});
