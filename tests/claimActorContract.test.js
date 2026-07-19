import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/rendering/ActorRenderer.js", import.meta.url);

test("Claim actor integration preserves one physical scythe and exact home attachment", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.equal((source.match(/this\.scythe\s*=\s*createScytheModel\(\)/g) ?? []).length, 1);
  assert.match(source, /this\.weaponHomeParent\s*=\s*this\.weaponParent/);
  assert.match(source, /this\.weaponHomePosition\s*=\s*this\.weaponGrip\.position\.clone\(\)/);
  assert.match(source, /this\.weaponHomeQuaternion\s*=\s*this\.weaponGrip\.quaternion\.clone\(\)/);
  assert.match(source, /this\.weaponHomeScale\s*=\s*this\.weaponGrip\.scale\.clone\(\)/);
  assert.match(source, /this\.scene\.attach\(this\.weaponGrip\)/);
  assert.match(source, /this\.weaponHomeParent\.attach\(this\.weaponGrip\)/);
  assert.match(source, /this\.weaponGrip\.position\.copy\(this\.weaponHomePosition\)/);
  assert.match(source, /this\.weaponGrip\.quaternion\.copy\(this\.weaponHomeQuaternion\)/);
  assert.match(source, /this\.weaponGrip\.scale\.copy\(this\.weaponHomeScale\)/);
});

test("Claim actor integration samples frozen snapshots and seeks body clips without render-time progression", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /sampleReapersClaimAnimation/);
  assert.match(source, /const snapshots = game\.claimSnapshots/);
  assert.match(source, /game\.combat\?\.claim\?\.snapshot\?\.\(\)/);
  assert.match(source, /this\.claimPose\.bodyYaw/);
  assert.match(source, /this\.currentAction\.paused = true/);
  assert.match(source, /this\.currentAction\.time = clipDuration \* this\.claimPose\.bodyClipProgress/);
  assert.match(source, /this\.currentAction\.paused = false/);
  assert.match(source, /this\.claimPresentationActive = true/);
  assert.match(source, /if \(!wasActive\) return/);
  assert.match(source, /this\.playerModel\.quaternion\.copy\(this\.playerModelHomeQuaternion\)\.multiply\(this\.claimBodyLeanQuaternion\)/);
  assert.match(source, /game\.settings\?\.get\?\.\("camera\.reducedMotion"\)/);
});

test("Claim ownership drives the existing grip and preallocated blade trail across all exit paths", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /this\.weaponGrip\.position\.set\(pose\.weaponPosition\.x, pose\.weaponHeight, pose\.weaponPosition\.z\)/);
  assert.match(source, /pose\.weaponDetached/);
  assert.match(source, /pose\.weaponSpin/);
  assert.match(source, /phase === "dead"/);
  assert.match(source, /phase === "portalTraversal"/);
  assert.match(source, /phase === "roomTransition"/);
  assert.match(source, /phase\.startsWith\("ending"\)/);
  assert.match(source, /this\.bladeHeel\.getWorldPosition\(this\.bladeHeelWorld\)/);
  assert.match(source, /this\.bladeTip\.getWorldPosition\(this\.bladeTipWorld\)/);
  assert.match(source, /this\.appendBladeTrailSample\(this\.bladeHeelWorld, this\.bladeTipWorld\)/);
  assert.match(source, /this\.writeBladeTrail\(claimPose\.trailStrength, claimPose\.phase === "empoweredCleave"\)/);
  assert.match(source, /this\.bladeTrailClaimActionId/);
  assert.match(source, /this\.bladeTrailClaimPhase/);
});

test("player actor presentation applies additive bone poses after mixer sampling and restores them before the next frame", async () => {
  const source = await readFile(sourceUrl, "utf8");
  assert.match(source, /new PlayerActorPresentation\(\)/);
  assert.match(source, /this\.restorePlayerActorPose\(\)/);
  assert.match(source, /this\.playerPresentation\.sample\(game, dt\)/);
  assert.match(source, /this\.mixer\.update\(dt\)/);
  assert.match(source, /this\.applyPlayerActorPose\(this\.playerPose\)/);
  assert.match(source, /record\.baseQuaternion\.copy\(record\.object\.quaternion\)/);
  assert.match(source, /record\.object\.quaternion\.copy\(record\.baseQuaternion\)/);
  assert.match(source, /this\.playerPresentation\.handleEvent\(event\)/);
  assert.match(source, /color: 0x78d7f4/);
  assert.match(source, /rimMaterial\.color\.set\(0xf3d58a\)/);
});
