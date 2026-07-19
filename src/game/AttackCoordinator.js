const ATTACK_FAMILIES = Object.freeze(["melee", "ranged", "area"]);
const FAMILY_SET = new Set(ATTACK_FAMILIES);

function freezeLease(value) {
  return Object.freeze({ ...value });
}

function compareEnemyIds(left, right) {
  return left.localeCompare(right, "en", { numeric: true });
}

function validEnemyIds(values) {
  return Array.isArray(values)
    && values.every((id) => typeof id === "string" && id.length > 0)
    && new Set(values).size === values.length;
}

function validateProfile(profile) {
  if (!profile || typeof profile !== "object" || typeof profile.id !== "string") {
    throw new TypeError("A difficulty profile is required.");
  }
  const budgets = profile.attackBudgets;
  if (!budgets || !["total", ...ATTACK_FAMILIES].every((key) => (
    Number.isInteger(budgets[key]) && budgets[key] >= 1
  ))) throw new TypeError("Difficulty attack budgets must be positive integers.");
  return profile;
}

export class AttackCoordinator {
  constructor() {
    this.leaseSerial = 0;
    this.stepSerial = 0;
    this.activeEnemyIds = [];
    this.activeEnemyIdSet = new Set();
    this.requestOrder = new Map();
    this.lastRequestIndex = -1;
    this.profile = null;
    this.leases = new Map();
    this.enemyLeaseIds = new Map();
    this.lastDenial = null;
  }

  beginStep(activeEnemyIds, difficultyProfile) {
    if (!validEnemyIds(activeEnemyIds)) throw new TypeError("Active enemy IDs must be unique non-empty strings.");
    this.profile = validateProfile(difficultyProfile);
    this.stepSerial += 1;
    this.activeEnemyIds = [...activeEnemyIds].sort(compareEnemyIds);
    this.activeEnemyIdSet = new Set(this.activeEnemyIds);
    this.requestOrder = new Map(this.activeEnemyIds.map((id, index) => [id, index]));
    this.lastRequestIndex = -1;
    this.lastDenial = null;

    for (const lease of [...this.leases.values()]) {
      if (!this.activeEnemyIdSet.has(lease.enemyId)) this.release(lease.leaseId, "inactive");
    }
    return this.snapshot();
  }

  isPreparedFor(enemyId) {
    return this.profile !== null && this.activeEnemyIdSet.has(enemyId);
  }

  request({ enemyId, family, priority = 0, telegraphDuration = 0 } = {}) {
    this.lastDenial = null;
    if (!this.profile) throw new Error("beginStep must be called before requesting an attack lease.");
    if (!this.activeEnemyIdSet.has(enemyId)) return this.deny("inactiveEnemy", enemyId, family);
    if (!FAMILY_SET.has(family)) return this.deny("unknownFamily", enemyId, family);
    if (!Number.isFinite(priority)) return this.deny("invalidPriority", enemyId, family);
    if (!Number.isFinite(telegraphDuration) || telegraphDuration < 0) {
      return this.deny("invalidTelegraph", enemyId, family);
    }
    if (this.enemyLeaseIds.has(enemyId)) return this.deny("alreadyCommitted", enemyId, family);

    const requestIndex = this.requestOrder.get(enemyId);
    if (requestIndex < this.lastRequestIndex) return this.deny("requestOrder", enemyId, family);
    this.lastRequestIndex = requestIndex;

    const leases = [...this.leases.values()];
    if (leases.length >= this.profile.attackBudgets.total) return this.deny("totalBudget", enemyId, family);
    const familyCount = leases.filter((lease) => lease.family === family).length;
    if (familyCount >= this.profile.attackBudgets[family]) return this.deny("familyBudget", enemyId, family);

    this.leaseSerial += 1;
    const lease = freezeLease({
      leaseId: `attack-lease-${this.leaseSerial}`,
      enemyId,
      family,
      priority,
      telegraphDuration,
      difficultyId: this.profile.id,
      grantedStep: this.stepSerial,
    });
    this.leases.set(lease.leaseId, lease);
    this.enemyLeaseIds.set(enemyId, lease.leaseId);
    return lease;
  }

  deny(reason, enemyId, family) {
    this.lastDenial = Object.freeze({ reason, enemyId: enemyId ?? null, family: family ?? null });
    return null;
  }

  release(leaseId, reason = "completed") {
    const lease = this.leases.get(leaseId);
    if (!lease) return false;
    this.leases.delete(leaseId);
    this.enemyLeaseIds.delete(lease.enemyId);
    this.lastRelease = Object.freeze({ leaseId, enemyId: lease.enemyId, family: lease.family, reason });
    return true;
  }

  releaseEnemy(enemyId, reason = "interrupted") {
    const leaseId = this.enemyLeaseIds.get(enemyId);
    return leaseId ? this.release(leaseId, reason) : false;
  }

  reset(reason = "reset") {
    for (const leaseId of [...this.leases.keys()]) this.release(leaseId, reason);
    this.profile = null;
    this.activeEnemyIds = [];
    this.activeEnemyIdSet.clear();
    this.requestOrder.clear();
    this.lastRequestIndex = -1;
    this.lastDenial = null;
  }

  snapshot() {
    const leases = [...this.leases.values()]
      .sort((left, right) => compareEnemyIds(left.enemyId, right.enemyId))
      .map((lease) => freezeLease(lease));
    return Object.freeze({
      difficultyId: this.profile?.id ?? null,
      step: this.stepSerial,
      capacity: this.profile ? Object.freeze({ ...this.profile.attackBudgets }) : null,
      leases: Object.freeze(leases),
    });
  }
}

export const ATTACK_COORDINATOR_FAMILIES = ATTACK_FAMILIES;
