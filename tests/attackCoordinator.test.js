import assert from "node:assert/strict";
import test from "node:test";
import { AttackCoordinator } from "../src/game/AttackCoordinator.js";
import { DIFFICULTY } from "../src/game/gameConfig.js";

test("leases obey stable natural enemy order and expose immutable resolved identity", () => {
  const coordinator = new AttackCoordinator();
  assert.equal(coordinator.isPreparedFor("enemy-1"), false);
  coordinator.beginStep(["enemy-10", "enemy-2", "enemy-1"], DIFFICULTY.standard);
  assert.equal(coordinator.isPreparedFor("enemy-1"), true);
  assert.equal(coordinator.isPreparedFor("enemy-3"), false);
  const first = coordinator.request({
    enemyId: "enemy-1", family: "melee", priority: 2, telegraphDuration: 0.4,
  });
  const second = coordinator.request({
    enemyId: "enemy-2", family: "ranged", priority: 1, telegraphDuration: 0.7,
  });

  assert.deepEqual(first, {
    leaseId: "attack-lease-1",
    enemyId: "enemy-1",
    family: "melee",
    priority: 2,
    telegraphDuration: 0.4,
    difficultyId: "standard",
    grantedStep: 1,
  });
  assert.equal(Object.isFrozen(first), true);
  assert.equal(second.leaseId, "attack-lease-2");
  assert.deepEqual(coordinator.snapshot().leases.map(({ enemyId }) => enemyId), ["enemy-1", "enemy-2"]);
  assert.equal(Object.isFrozen(coordinator.snapshot().leases), true);
});

test("family and total budgets create behavioral differences between difficulties", () => {
  const relaxed = new AttackCoordinator();
  relaxed.beginStep(["e1", "e2", "e3", "e4"], DIFFICULTY.relaxed);
  assert.ok(relaxed.request({ enemyId: "e1", family: "area" }));
  assert.equal(relaxed.request({ enemyId: "e2", family: "area" }), null);
  assert.equal(relaxed.lastDenial.reason, "familyBudget");
  assert.ok(relaxed.request({ enemyId: "e3", family: "melee" }));
  assert.ok(relaxed.request({ enemyId: "e4", family: "ranged" }));

  const ruthless = new AttackCoordinator();
  ruthless.beginStep(["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10", "e11"], DIFFICULTY.ruthless);
  assert.ok(ruthless.request({ enemyId: "e1", family: "area" }));
  assert.ok(ruthless.request({ enemyId: "e2", family: "area" }));
  assert.ok(ruthless.request({ enemyId: "e3", family: "area" }));
  assert.ok(ruthless.request({ enemyId: "e4", family: "melee" }));
  assert.ok(ruthless.request({ enemyId: "e5", family: "melee" }));
  assert.ok(ruthless.request({ enemyId: "e6", family: "melee" }));
  assert.ok(ruthless.request({ enemyId: "e7", family: "ranged" }));
  assert.ok(ruthless.request({ enemyId: "e8", family: "ranged" }));
  assert.ok(ruthless.request({ enemyId: "e9", family: "ranged" }));
  assert.ok(ruthless.request({ enemyId: "e10", family: "ranged" }));
  assert.equal(ruthless.request({ enemyId: "e11", family: "melee" }), null);
  assert.equal(ruthless.lastDenial.reason, "totalBudget");
});

test("duplicate and out-of-order requests are rejected without stealing capacity", () => {
  const coordinator = new AttackCoordinator();
  coordinator.beginStep(["enemy-1", "enemy-2", "enemy-3"], DIFFICULTY.standard);
  const lease = coordinator.request({ enemyId: "enemy-2", family: "melee" });
  assert.ok(lease);
  assert.equal(coordinator.request({ enemyId: "enemy-2", family: "area" }), null);
  assert.equal(coordinator.lastDenial.reason, "alreadyCommitted");
  assert.equal(coordinator.request({ enemyId: "enemy-1", family: "melee" }), null);
  assert.equal(coordinator.lastDenial.reason, "requestOrder");
  assert.equal(coordinator.snapshot().leases.length, 1);
});

test("release is exactly-once and stale actors cannot leak commitments across steps", () => {
  const coordinator = new AttackCoordinator();
  coordinator.beginStep(["enemy-1", "enemy-2"], DIFFICULTY.standard);
  const first = coordinator.request({ enemyId: "enemy-1", family: "melee" });
  const second = coordinator.request({ enemyId: "enemy-2", family: "ranged" });
  assert.equal(coordinator.release(first.leaseId, "completed"), true);
  assert.equal(coordinator.release(first.leaseId, "completed"), false);
  assert.equal(coordinator.releaseEnemy("enemy-2", "staggered"), true);
  assert.equal(coordinator.releaseEnemy("enemy-2", "staggered"), false);
  assert.equal(coordinator.snapshot().leases.length, 0);

  coordinator.beginStep(["enemy-1", "enemy-2"], DIFFICULTY.standard);
  coordinator.request({ enemyId: "enemy-1", family: "area" });
  coordinator.beginStep(["enemy-2"], DIFFICULTY.standard);
  assert.equal(coordinator.snapshot().leases.length, 0);
  assert.equal(second.enemyId, "enemy-2");
});

test("invalid requests fail closed and reset removes all run authority", () => {
  const coordinator = new AttackCoordinator();
  assert.throws(() => coordinator.request({ enemyId: "e1", family: "melee" }), /beginStep/);
  assert.throws(() => coordinator.beginStep(["e1", "e1"], DIFFICULTY.standard), /unique/);
  coordinator.beginStep(["e1"], DIFFICULTY.standard);
  assert.equal(coordinator.request({ enemyId: "e1", family: "spell" }), null);
  assert.equal(coordinator.lastDenial.reason, "unknownFamily");
  coordinator.request({ enemyId: "e1", family: "melee" });
  coordinator.reset("runEnded");
  assert.deepEqual(coordinator.snapshot(), {
    difficultyId: null,
    step: 1,
    capacity: null,
    leases: [],
  });
});
