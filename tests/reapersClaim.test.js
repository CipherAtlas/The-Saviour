import assert from "node:assert/strict";
import test from "node:test";
import { CLAIM_CONFIG } from "../src/game/gameConfig.js";
import { ReapersClaim } from "../src/game/ReapersClaim.js";

function startClaim(events = []) {
  const claim = new ReapersClaim((type, detail) => events.push({ type, detail }));
  const result = claim.requestStart({ origin: { x: 2, z: 3 }, direction: { x: 4, z: 0 }, inputTime: 10 });
  assert.equal(result.accepted, true);
  return claim;
}

test("Claim freezes normalized aim and advances an authoritative swept path", () => {
  const sweeps = [];
  const claim = startClaim();
  claim.update(CLAIM_CONFIG.outbound.duration / 2, (query) => {
    sweeps.push(query);
    return [];
  });
  const snapshot = claim.snapshot();
  const travelProgress = (CLAIM_CONFIG.outbound.duration / 2 - CLAIM_CONFIG.outbound.releaseAt)
    / (CLAIM_CONFIG.outbound.duration - CLAIM_CONFIG.outbound.releaseAt);
  assert.deepEqual(snapshot.direction, { x: 1, z: 0 });
  assert.equal(snapshot.scythePosition.x, 2 + CLAIM_CONFIG.outbound.distance * travelProgress);
  assert.deepEqual(sweeps[0].from, { x: 2, z: 3 });
  assert.deepEqual(sweeps[0].to, snapshot.scythePosition);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.scythePosition), true);
});

test("Claim stays in hand and cannot collide before its configured release contact", () => {
  const events = [];
  const sweeps = [];
  const claim = startClaim(events);
  claim.update(CLAIM_CONFIG.outbound.releaseAt, (query) => {
    sweeps.push(query);
    return [{ targetId: "too-early" }];
  });

  assert.deepEqual(claim.snapshot().scythePosition, { x: 2, z: 3 });
  assert.equal(claim.snapshot().outboundProgress, 0);
  assert.equal(sweeps.length, 0);
  assert.equal(events.some((event) => event.type === "claimHit"), false);

  claim.update(0.01, (query) => {
    sweeps.push(query);
    return [{ targetId: "released", hit: { damage: 1 } }];
  });
  assert.equal(sweeps.length, 1);
  assert.deepEqual(sweeps[0].from, { x: 2, z: 3 });
  assert.ok(sweeps[0].to.x > 2);
  assert.equal(events.filter((event) => event.type === "claimHit").length, 1);
});

test("outbound and recall each hit a target once and may hit it twice total", () => {
  const events = [];
  const claim = startClaim(events);
  const adapter = () => [{ targetId: "shade-1", hit: { damage: 1 } }, { targetId: "shade-1", hit: { damage: 1 } }];
  claim.update(CLAIM_CONFIG.outbound.duration, adapter);
  claim.update(CLAIM_CONFIG.recall.duration, adapter);
  const hits = events.filter((event) => event.type === "claimHit");
  assert.deepEqual(hits.map((event) => event.detail.pass), ["outbound", "recall"]);
  assert.ok(hits.every((event) => ["outbound", "recall"].includes(event.detail.pass)));
});

test("a late recall press buffers through catch and commits the empowered cleave", () => {
  const events = [];
  const claim = startClaim(events);
  claim.update(CLAIM_CONFIG.outbound.duration, () => []);
  claim.update(CLAIM_CONFIG.recall.duration - CLAIM_CONFIG.recall.followupBuffer / 2, () => []);
  assert.equal(claim.bufferFollowup(11).accepted, true);
  claim.update(CLAIM_CONFIG.recall.followupBuffer, () => []);
  assert.equal(claim.snapshot().phase, "empoweredCleave");
  const ready = events.find((event) => event.type === "claimFollowupReady");
  const consumed = events.find((event) => event.type === "claimFollowupConsumed");
  assert.equal(ready.detail.buffered, true);
  assert.equal(consumed.detail.activeStart, CLAIM_CONFIG.empoweredCleave.activeStart);
  assert.equal(events.filter((event) => event.type === "claimFollowupConsumed").length, 1);
});

test("an unused empowered window expires through recovery and permits immediate reuse", () => {
  const events = [];
  const claim = startClaim(events);
  claim.update(
    CLAIM_CONFIG.outbound.duration + CLAIM_CONFIG.recall.duration + CLAIM_CONFIG.empoweredWindow
      + CLAIM_CONFIG.recoveryDuration,
    () => [],
  );
  assert.equal(claim.snapshot().phase, "idle");
  assert.equal(events.find((event) => event.type === "claimCompleted").detail.result, "expired");
  assert.equal(claim.requestStart({ origin: { x: 0, z: 0 }, direction: { x: 0, z: 1 }, inputTime: 20 }).accepted, true);
});

test("cancel is idempotent and clears bounded pass ownership once", () => {
  const events = [];
  const claim = startClaim(events);
  claim.cancel("roomReplacement");
  claim.cancel("roomReplacement");
  assert.equal(claim.snapshot().phase, "idle");
  assert.equal(claim.snapshot().weaponDetached, false);
  assert.equal(events.filter((event) => event.type === "claimCompleted").length, 1);
});

test("completion remains exactly once when recovery is cancelled by dash or reset", () => {
  for (const reason of ["dash", "reset"]) {
    const events = [];
    const claim = startClaim(events);
    claim.update(
      CLAIM_CONFIG.outbound.duration + CLAIM_CONFIG.recall.duration + CLAIM_CONFIG.empoweredWindow,
      () => [],
    );
    assert.equal(claim.snapshot().phase, "recovery");
    claim.cancel(reason);
    claim.cancel(reason);
    const completed = events.filter((event) => event.type === "claimCompleted");
    assert.equal(completed.length, 1);
    assert.equal(completed[0].detail.result, "expired");
  }
});

test("request validation is side-effect-free and requestStart shares its rejection reasons", () => {
  const events = [];
  const claim = new ReapersClaim((type, detail) => events.push({ type, detail }));
  const invalidRequests = [
    [{ origin: { x: Number.NaN, z: 0 }, direction: { x: 1, z: 0 }, inputTime: 1 }, "invalidRequest"],
    [{ origin: { x: 0, z: 0 }, direction: { x: 0, z: 0 }, inputTime: 1 }, "invalidDirection"],
    [{ origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, inputTime: Number.NaN }, "invalidRequest"],
  ];
  for (const [request, reason] of invalidRequests) {
    assert.deepEqual(claim.validateRequest(request), { accepted: false, reason });
  }
  assert.equal(claim.snapshot().phase, "idle");
  assert.equal(events.length, 0);
  const invalid = invalidRequests[0][0];
  assert.equal(claim.requestStart(invalid).accepted, false);
  assert.equal(events[0].detail.reason, "invalidRequest");

  assert.equal(claim.requestStart({ origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, inputTime: 2 }).accepted, true);
  assert.deepEqual(
    claim.validateRequest({ origin: { x: 0, z: 0 }, direction: { x: 1, z: 0 }, inputTime: 3 }),
    { accepted: false, reason: "illegalPhase" },
  );
});

test("empowered cleave resolves through the adapter without widening the claimHit pass union", () => {
  const events = [];
  const claim = startClaim(events);
  let resolved = 0;
  claim.update(CLAIM_CONFIG.outbound.duration + CLAIM_CONFIG.recall.duration, () => []);
  assert.equal(claim.bufferFollowup(11).accepted, true);
  claim.update(CLAIM_CONFIG.empoweredCleave.activeStart, {
    querySweep: () => [{ targetId: "shade-cleave" }],
    resolveHit: () => {
      resolved += 1;
      return { hit: { damage: CLAIM_CONFIG.empoweredCleave.damage } };
    },
  });
  assert.equal(resolved, 1);
  assert.ok(events.filter((event) => event.type === "claimHit").every((event) => ["outbound", "recall"].includes(event.detail.pass)));
});

test("adapter cancellation aborts the active pass without resolving later candidates or publishing stale ids", () => {
  const events = [];
  const claim = startClaim(events);
  const actionId = claim.snapshot().actionId;
  const resolved = [];

  claim.update(CLAIM_CONFIG.outbound.duration / 2, {
    querySweep: () => [{ targetId: "queen" }, { targetId: "guard" }],
    resolveHit: ({ target }) => {
      resolved.push(target.targetId);
      claim.cancel("ending");
      return { hit: { damage: 1 } };
    },
  });

  assert.deepEqual(resolved, ["queen"]);
  assert.equal(claim.snapshot().phase, "idle");
  const completed = events.filter((event) => event.type === "claimCompleted");
  assert.equal(completed.length, 1);
  assert.equal(completed[0].detail.actionId, actionId);
  assert.equal(completed[0].detail.result, "cancelled");
  assert.ok(events.every((event) => event.detail.actionId !== null));
});

test("terminatePass commits the current hit with its original action id and stops the pass", () => {
  const events = [];
  const claim = startClaim(events);
  const actionId = claim.snapshot().actionId;
  const resolved = [];

  claim.update(CLAIM_CONFIG.outbound.duration / 2, {
    querySweep: () => [{ targetId: "queen" }, { targetId: "guard" }],
    resolveHit: ({ target }) => {
      resolved.push(target.targetId);
      return Object.freeze({ hit: Object.freeze({ damage: 1 }), terminatePass: true });
    },
  });

  assert.deepEqual(resolved, ["queen"]);
  const hits = events.filter((event) => event.type === "claimHit");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].detail.actionId, actionId);
  assert.equal(hits[0].detail.targetId, "queen");
  assert.equal(claim.snapshot().phase, "outbound");
});

test("ordinary multi-target collision resolution remains ordered and complete", () => {
  const events = [];
  const claim = startClaim(events);
  const actionId = claim.snapshot().actionId;
  const resolved = [];

  claim.update(CLAIM_CONFIG.outbound.duration / 2, {
    querySweep: () => [{ targetId: "shade-1" }, { targetId: "shade-2" }],
    resolveHit: ({ target }) => {
      resolved.push(target.targetId);
      return { hit: { damage: 1 } };
    },
  });

  assert.deepEqual(resolved, ["shade-1", "shade-2"]);
  const hits = events.filter((event) => event.type === "claimHit");
  assert.deepEqual(hits.map((event) => event.detail.targetId), resolved);
  assert.ok(hits.every((event) => event.detail.actionId === actionId));
  assert.equal(claim.snapshot().phase, "outbound");
});
