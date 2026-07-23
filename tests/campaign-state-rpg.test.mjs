import assert from "node:assert/strict";
import test from "node:test";

import {
  createCampaign,
  startRun,
  applyCampaignRunResult,
  captureElite,
  setCompanionLoadout,
  serializeCampaign,
  restoreCampaign,
  echoCoreEarned,
  boundFragmentEarned,
  echoCoreSpent,
  boundFragmentSpent,
  equipmentTierIndexFor,
  wardenRuntimeStatsForCampaign,
  companionRuntimeStatsForCampaign,
  companionFormationSlot,
  wardLevel,
  allocateWardenStatPoint,
  unlockWardenSkillNode,
  selectWardenTrait,
  purchaseEquipmentTier,
  setCompanionFormationSlot,
  settleIdleReturn,
  IDLE_RETURN_INTERVAL_MS,
} from "../campaign-state.js";

function campaignWithElitesAndResolves(campaignId, { elites = [], stages = [] } = {}) {
  let campaign = createCampaign({ campaignId });
  for (const [eliteId, prototype] of elites) campaign = captureElite(campaign, eliteId, prototype);
  for (const stageId of stages) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  return campaign;
}

test("echoCoreEarned weights captured elites at 1x and resolved stages at 3x (not the swapped order)", () => {
  const campaign = campaignWithElitesAndResolves("echo-earn", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  // 2 distinct captured elite ids (1 each) + 1 resolved stage * 3 = 5. A swapped weighting
  // (capturedEliteCount*3 + resolvedIds.length*1) would instead yield 2*3 + 1*1 = 7.
  assert.equal(echoCoreEarned(campaign), 5);
});

test("echoCoreEarned counts distinct captured elite ids, not total capture calls, and caps naturally via companionCollection size", () => {
  let campaign = createCampaign({ campaignId: "echo-distinct" });
  campaign = captureElite(campaign, "elite-a", "ember-cohort");
  campaign = captureElite(campaign, "elite-b", "ember-cohort"); // same prototype, second elite -> evolution bump, still +1 distinct id
  assert.equal(campaign.companionCollection[0].evolution, 2);
  assert.equal(echoCoreEarned(campaign), 2, "two distinct elite ids captured onto the same prototype still count as 2");

  const repeatCapture = captureElite(campaign, "elite-a", "ember-cohort");
  assert.equal(echoCoreEarned(repeatCapture), 2, "recapturing an already-captured elite id does not double count");
});

test("echoCoreEarned caps captured-elite contribution at the canonical stage count (10), closing a budget-bypass exploit via excess elite captures", () => {
  let campaign = createCampaign({ campaignId: "echo-cap-exploit-guard" });
  for (let i = 0; i < 40; i += 1) campaign = captureElite(campaign, `elite-${i}`, "ember-cohort");
  assert.equal(echoCoreEarned(campaign), 10, "40 distinct captured elites must still only contribute 10 Echo Core, not 40 -- otherwise validWardenProgress's budget check can be bypassed via a tampered save with fabricated elite ids");
});

test("boundFragmentEarned equals the resolved stage count", () => {
  const campaign = campaignWithElitesAndResolves("bound-earn", { stages: ["cinder-span"] });
  assert.equal(boundFragmentEarned(campaign), 1);
  assert.equal(boundFragmentEarned(createCampaign({ campaignId: "bound-zero" })), 0);
});

test("wardLevel derives from resolvedIds.length + floor(companionCollection.length / 2)", () => {
  const campaign = campaignWithElitesAndResolves("ward-level", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
    stages: ["cinder-span"],
  });
  // resolvedIds.length=1, companionCollection.length=3, floor(3/2)=1 -> 2
  assert.equal(wardLevel(campaign), 2);
  assert.equal(wardLevel(createCampaign({ campaignId: "ward-zero" })), 0);
});

test("companionFormationSlot defaults to BACK for an unassigned companion", () => {
  const campaign = createCampaign({ campaignId: "formation-default" });
  assert.equal(companionFormationSlot(campaign, "ember-cohort"), "BACK");
});

test("allocateWardenStatPoint enforces the per-stat max points cap", () => {
  // Legitimately earn the full 40 Echo Core budget via a complete campaign: 10 resolved stages (30 EC)
  // + 10 distinct captured elites, stage-capped (10 EC) -- matches the real economy, not an exploit path.
  const stageOrder = ["cinder-span", "veil-citadel", "echo-throne", "sunken-bastion", "howling-sprawl", "glass-necropolis", "starless-canal", "shattered-causeway", "abyss-chancel", "gate-zenith"];
  const companionCycle = ["ember-cohort", "rift-lens", "veil-vanguard", "anchor-shard", "throne-echo", "dawnless-crown"];
  let campaign = createCampaign({ campaignId: "stat-maxpoints" });
  stageOrder.forEach((stageId, i) => {
    campaign = captureElite(campaign, `elite-${i}`, companionCycle[i % companionCycle.length]);
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  });
  assert.equal(echoCoreEarned(campaign), 40, `expected exactly 40 Echo Core from a full campaign, got ${echoCoreEarned(campaign)}`);

  let maxed = campaign;
  for (let i = 0; i < 10; i += 1) maxed = allocateWardenStatPoint(maxed, "binding-might");
  assert.equal(maxed.wardenProgress.statPoints["binding-might"], 10);
  assert.throws(() => allocateWardenStatPoint(maxed, "binding-might"), TypeError, "cannot exceed maxPoints");
});

test("allocateWardenStatPoint enforces the shared Echo Core budget, including cross-blocking against skill-tree spending", () => {
  const campaign = campaignWithElitesAndResolves("stat-budget", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  assert.equal(echoCoreEarned(campaign), 5);

  const afterOne = allocateWardenStatPoint(campaign, "binding-might");
  assert.equal(afterOne.wardenProgress.statPoints["binding-might"], 1);
  assert.equal(echoCoreSpent(afterOne), 2);

  assert.throws(() => allocateWardenStatPoint(campaign, "not-a-stat"), TypeError);

  // 3rd point on binding-might costs 3, cumulative 2+2+3=7 > earned 5
  const afterTwo = allocateWardenStatPoint(afterOne, "binding-might");
  assert.throws(() => allocateWardenStatPoint(afterTwo, "binding-might"), TypeError, "3rd point exceeds the 5-point budget");

  // Cross-blocking: spend the entire 5-point budget on a skill node, then a stat point must fail.
  const skillSpent = unlockWardenSkillNode(campaign, "wardens-ward"); // cost 5, exhausts the budget
  assert.throws(() => allocateWardenStatPoint(skillSpent, "binding-might"), TypeError, "stat allocation must be blocked once the shared budget is exhausted by skill spending");
});

test("unlockWardenSkillNode enforces prerequisites and the shared Echo Core budget", () => {
  const campaign = campaignWithElitesAndResolves("skill-budget", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  assert.throws(() => unlockWardenSkillNode(campaign, "echo-cascade"), TypeError, "echo-cascade requires echo-backlash first");

  const backlash = unlockWardenSkillNode(campaign, "echo-backlash"); // cost 5
  assert.equal(echoCoreSpent(backlash), 5);
  assert.throws(() => unlockWardenSkillNode(backlash, "echo-cascade"), TypeError, "cost 8 exceeds the remaining 0 budget");
  assert.throws(() => unlockWardenSkillNode(backlash, "echo-backlash"), TypeError, "already unlocked");
});

test("selectWardenTrait gates by stage-clear sequence count and only accepts that sequence's offered 3 traits", () => {
  const campaign = createCampaign({ campaignId: "trait-select" });
  assert.throws(() => selectWardenTrait(campaign, "first-strike"), TypeError, "no stages resolved yet, sequence 2 not reached");

  let resolved = campaign;
  for (const stageId of ["cinder-span", "veil-citadel"]) {
    resolved = startRun(resolved, stageId);
    resolved = applyCampaignRunResult(resolved, { stageId, outcome: "victory" });
  }
  assert.equal(resolved.resolvedIds.length, 2);

  assert.throws(() => selectWardenTrait(resolved, "chain-reaction"), TypeError, "chain-reaction is not offered at sequence 2");
  const picked = selectWardenTrait(resolved, "first-strike");
  assert.deepEqual(picked.wardenProgress.traitIds, ["first-strike"]);

  assert.throws(() => selectWardenTrait(picked, "desperate-echo"), TypeError, "sequence 4 not yet reached (only 2 stages resolved)");
});

test("purchaseEquipmentTier validates ownerId, enforces max tier, and enforces the Bound Fragment budget", () => {
  const campaign = campaignWithElitesAndResolves("equip-budget", {
    elites: [["e1", "ember-cohort"]],
    stages: ["cinder-span"],
  });
  assert.equal(boundFragmentEarned(campaign), 1);

  assert.throws(() => purchaseEquipmentTier(campaign, "not-owned", "weapon"), TypeError);
  assert.throws(() => purchaseEquipmentTier(campaign, "warden", "not-a-slot"), TypeError);

  const upgraded = purchaseEquipmentTier(campaign, "warden", "weapon"); // step 0 costs 1
  assert.equal(equipmentTierIndexFor(upgraded, "warden", "weapon"), 1);
  assert.equal(boundFragmentSpent(upgraded), 1);
  assert.throws(() => purchaseEquipmentTier(upgraded, "warden", "weapon"), TypeError, "step 1 costs 2, total 3 exceeds the earned 1");

  // an owned companion is also a valid ownerId
  const companionEquip = purchaseEquipmentTier(campaign, "ember-cohort", "trinket");
  assert.equal(equipmentTierIndexFor(companionEquip, "ember-cohort", "trinket"), 1);
});

test("purchaseEquipmentTier rejects advancing past the top tier (T5)", () => {
  let campaign = createCampaign({ campaignId: "equip-max-tier" });
  // build up enough Bound Fragment to reach T5 on one slot (cost 1+2+3+4=10)
  for (const stageId of ["cinder-span", "veil-citadel", "echo-throne", "sunken-bastion", "howling-sprawl", "glass-necropolis", "starless-canal", "shattered-causeway", "abyss-chancel", "gate-zenith"]) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  assert.equal(boundFragmentEarned(campaign), 10);
  let maxed = campaign;
  for (let i = 0; i < 4; i += 1) maxed = purchaseEquipmentTier(maxed, "warden", "weapon");
  assert.equal(equipmentTierIndexFor(maxed, "warden", "weapon"), 4);
  assert.throws(() => purchaseEquipmentTier(maxed, "warden", "weapon"), TypeError, "already at T5 (max index 4)");
});

test("setCompanionFormationSlot requires loadout membership and enforces MAX_FRONT_SLOTS", () => {
  let campaign = campaignWithElitesAndResolves("formation-slots", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "veil-vanguard"]);

  assert.throws(() => setCompanionFormationSlot(campaign, "not-in-loadout", "FRONT"), TypeError);

  const oneFront = setCompanionFormationSlot(campaign, "ember-cohort", "FRONT");
  const twoFront = setCompanionFormationSlot(oneFront, "rift-lens", "FRONT");
  assert.equal(companionFormationSlot(twoFront, "ember-cohort"), "FRONT");
  assert.equal(companionFormationSlot(twoFront, "rift-lens"), "FRONT");
  assert.throws(() => setCompanionFormationSlot(twoFront, "veil-vanguard", "FRONT"), TypeError, "a 3rd FRONT companion must be rejected");

  const backAgain = setCompanionFormationSlot(twoFront, "ember-cohort", "BACK");
  assert.equal(companionFormationSlot(backAgain, "ember-cohort"), "BACK");
  const thirdNowFits = setCompanionFormationSlot(backAgain, "veil-vanguard", "FRONT");
  assert.equal(companionFormationSlot(thirdNowFits, "veil-vanguard"), "FRONT");
});

test("setCompanionLoadout drops companionFormation entries for companions no longer in the loadout", () => {
  let campaign = campaignWithElitesAndResolves("formation-prune", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens"]);
  campaign = setCompanionFormationSlot(campaign, "ember-cohort", "FRONT");
  assert.equal(companionFormationSlot(campaign, "ember-cohort"), "FRONT");

  const shrunk = setCompanionLoadout(campaign, ["rift-lens"]);
  assert.equal(companionFormationSlot(shrunk, "ember-cohort"), "BACK", "dropping a companion from the loadout resets its formation to the BACK default");
});

test("wardenRuntimeStatsForCampaign and companionRuntimeStatsForCampaign derive from live campaign state (stat points + equipment)", () => {
  const campaign = campaignWithElitesAndResolves("runtime-derive", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"]],
    stages: ["cinder-span"],
  });
  const withStat = allocateWardenStatPoint(campaign, "binding-might");
  const runtime = wardenRuntimeStatsForCampaign(withStat);
  assert.equal(runtime.basicDamageBonus, 15);

  const withEquip = purchaseEquipmentTier(campaign, "ember-cohort", "weapon");
  const companionRuntime = companionRuntimeStatsForCampaign(withEquip, "ember-cohort");
  assert.equal(companionRuntime.weaponTierMultiplier, 1.15);
  assert.equal(companionRuntime.role, "striker");
});

test("settleIdleReturn: INITIALIZED on first call, EARLY before one interval, SETTLED with award, NO_COMPLETED_STAGES with zero resolves", () => {
  const noStages = createCampaign({ campaignId: "idle-no-stages" });
  const first = settleIdleReturn(noStages, { now: 1000 });
  assert.equal(first.receipt.outcome, "INITIALIZED");
  assert.equal(first.campaign.idleReturn.lastSettledAt, 1000);

  const tooEarly = settleIdleReturn(first.campaign, { now: 1000 + IDLE_RETURN_INTERVAL_MS - 1 });
  assert.equal(tooEarly.receipt.outcome, "EARLY");

  const zeroStages = settleIdleReturn(first.campaign, { now: 1000 + IDLE_RETURN_INTERVAL_MS });
  assert.equal(zeroStages.receipt.outcome, "NO_COMPLETED_STAGES");

  let withStage = campaignWithElitesAndResolves("idle-settled", { stages: ["cinder-span"] });
  const initialized = settleIdleReturn(withStage, { now: 1000 });
  const settled = settleIdleReturn(initialized.campaign, { now: 1000 + IDLE_RETURN_INTERVAL_MS });
  assert.equal(settled.receipt.outcome, "SETTLED");
  assert.equal(settled.receipt.awardedProgress, 1); // 1 completed stage * floor(1 interval / 1 interval) = 1
  assert.equal(settled.campaign.idleReturn.totalProgress, 1);
});

test("settleIdleReturn returns ENCROACHED and forfeits the award when pressure exceeds wardLevel, but still advances lastSettledAt and leaves totalProgress unchanged", () => {
  let campaign = campaignWithElitesAndResolves("idle-encroached", { stages: ["cinder-span"] }); // wardLevel = 1 + floor(0/2) = 1
  assert.equal(wardLevel(campaign), 1);

  const initialized = settleIdleReturn(campaign, { now: 1000 });
  const priorProgress = initialized.campaign.idleReturn.totalProgress;

  // pressure = min(floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8); need pressure > wardLevel(1), so pressure=2
  const elapsedForPressure2 = 2 * 60 * IDLE_RETURN_INTERVAL_MS;
  const encroached = settleIdleReturn(initialized.campaign, { now: 1000 + elapsedForPressure2 });
  assert.equal(encroached.receipt.outcome, "ENCROACHED");
  assert.equal(encroached.campaign.idleReturn.totalProgress, priorProgress, "the forfeited window must not add to totalProgress");
  assert.equal(encroached.campaign.idleReturn.lastSettledAt, 1000 + elapsedForPressure2, "lastSettledAt still advances despite the forfeiture");
});

test("settleIdleReturn SETTLES normally when pressure does not exceed wardLevel (guard against an always-ENCROACHED regression)", () => {
  // build wardLevel up to 3 (3 resolved stages) so a 2-hour-equivalent pressure of 2 does not encroach
  let campaign = createCampaign({ campaignId: "idle-not-encroached" });
  for (const stageId of ["cinder-span", "veil-citadel", "echo-throne"]) {
    campaign = startRun(campaign, stageId);
    campaign = applyCampaignRunResult(campaign, { stageId, outcome: "victory" });
  }
  assert.equal(wardLevel(campaign), 3);
  const initialized = settleIdleReturn(campaign, { now: 1000 });
  const elapsedForPressure2 = 2 * 60 * IDLE_RETURN_INTERVAL_MS;
  const settled = settleIdleReturn(initialized.campaign, { now: 1000 + elapsedForPressure2 });
  assert.equal(settled.receipt.outcome, "SETTLED");
  assert.ok(settled.campaign.idleReturn.totalProgress > 0);
});

test("restoreCampaign migrates all four historical shapes, defaulting missing RPG-era fields", () => {
  let campaign = createCampaign({ campaignId: "migrate-shapes", resetEpoch: 7 });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });
  const current = serializeCampaign(campaign);
  assert.equal(Object.keys(current).length, 14);
  assert.ok(current.rewardIds.length > 0);
  assert.ok(current.achievementIds.length > 0);

  // shape (a): oldest 8-key pre-reward shape
  const shapeA = { ...current };
  delete shapeA.rewardIds;
  delete shapeA.achievementIds;
  delete shapeA.idleReturn;
  delete shapeA.wardenProgress;
  delete shapeA.ownedEquipmentIds;
  delete shapeA.companionFormation;
  assert.equal(Object.keys(shapeA).length, 8);
  const restoredA = restoreCampaign(shapeA);
  assert.ok(restoredA);
  assert.deepEqual(restoredA.rewardIds, []);
  assert.deepEqual(restoredA.achievementIds, []);
  assert.deepEqual(restoredA.idleReturn, { version: 1, lastSettledAt: null, totalProgress: 0 });
  assert.deepEqual(restoredA.wardenProgress, { statPoints: {}, skillTreeIds: [], traitIds: [] });
  assert.deepEqual(restoredA.ownedEquipmentIds, []);
  assert.deepEqual(restoredA.companionFormation, {});

  // shape (b): 9-key (+idleReturn, no rewards)
  const shapeB = { ...current };
  delete shapeB.rewardIds;
  delete shapeB.achievementIds;
  delete shapeB.wardenProgress;
  delete shapeB.ownedEquipmentIds;
  delete shapeB.companionFormation;
  assert.equal(Object.keys(shapeB).length, 9);
  const restoredB = restoreCampaign(shapeB);
  assert.ok(restoredB);
  assert.deepEqual(restoredB.rewardIds, []);
  assert.deepEqual(restoredB.idleReturn, current.idleReturn);

  // shape (c): 10-key (+rewards, no idleReturn)
  const shapeC = { ...current };
  delete shapeC.idleReturn;
  delete shapeC.wardenProgress;
  delete shapeC.ownedEquipmentIds;
  delete shapeC.companionFormation;
  assert.equal(Object.keys(shapeC).length, 10);
  const restoredC = restoreCampaign(shapeC);
  assert.ok(restoredC);
  assert.deepEqual(restoredC.rewardIds, current.rewardIds);
  assert.deepEqual(restoredC.idleReturn, { version: 1, lastSettledAt: null, totalProgress: 0 });

  // shape (d): 11-key current pre-RPG production shape (rewards+idleReturn, no RPG fields),
  // WITH non-empty rewardIds/achievementIds — regression: an earlier implementation wiped these.
  const shapeD = { ...current };
  delete shapeD.wardenProgress;
  delete shapeD.ownedEquipmentIds;
  delete shapeD.companionFormation;
  assert.equal(Object.keys(shapeD).length, 11);
  const restoredD = restoreCampaign(shapeD);
  assert.ok(restoredD);
  assert.deepEqual(restoredD.rewardIds, current.rewardIds, "non-empty rewardIds must round-trip unchanged through migration");
  assert.deepEqual(restoredD.achievementIds, current.achievementIds, "non-empty achievementIds must round-trip unchanged through migration");
  assert.deepEqual(restoredD.wardenProgress, { statPoints: {}, skillTreeIds: [], traitIds: [] });
  assert.deepEqual(restoredD.ownedEquipmentIds, []);
  assert.deepEqual(restoredD.companionFormation, {});
});

test("restoreCampaign rejects a tampered save with an unaffordable statPoints total", () => {
  const campaign = campaignWithElitesAndResolves("tamper-stat", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
    stages: ["cinder-span"],
  });
  const base = serializeCampaign(campaign); // echoCoreEarned = 3 + 1*3 = 6
  const tampered = { ...base, wardenProgress: { statPoints: { "binding-might": 10 }, skillTreeIds: [], traitIds: [] } }; // cost 40 > earned 6
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save with an unaffordable ownedEquipmentIds total", () => {
  const campaign = campaignWithElitesAndResolves("tamper-equip", {
    elites: [["e1", "ember-cohort"]],
    stages: ["cinder-span"],
  });
  const base = serializeCampaign(campaign); // boundFragmentEarned = 1
  const tampered = { ...base, ownedEquipmentIds: ["warden:weapon:0", "warden:weapon:1", "warden:weapon:2", "warden:weapon:3"] }; // cost 1+2+3+4=10 > earned 1
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save with more traitIds than WARDEN_TRAIT_UNLOCK_SEQUENCES.length", () => {
  const campaign = createCampaign({ campaignId: "tamper-traits" });
  const base = serializeCampaign(campaign);
  const tampered = {
    ...base,
    wardenProgress: {
      statPoints: {},
      skillTreeIds: [],
      traitIds: ["first-strike", "desperate-echo", "reckless-reclaim", "gate-keeper", "chain-reaction", "elite-hunter"],
    },
  };
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save with more than MAX_FRONT_SLOTS FRONT companions in companionFormation", () => {
  let campaign = campaignWithElitesAndResolves("tamper-formation-front", {
    elites: [["e1", "ember-cohort"], ["e2", "rift-lens"], ["e3", "veil-vanguard"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort", "rift-lens", "veil-vanguard"]);
  const base = serializeCampaign(campaign);
  const tampered = { ...base, companionFormation: { "ember-cohort": "FRONT", "rift-lens": "FRONT", "veil-vanguard": "FRONT" } };
  assert.equal(restoreCampaign(tampered), null);
});

test("restoreCampaign rejects a tampered save whose companionFormation references a companion not in the current loadout", () => {
  let campaign = campaignWithElitesAndResolves("tamper-formation-ref", {
    elites: [["e1", "ember-cohort"]],
  });
  campaign = setCompanionLoadout(campaign, ["ember-cohort"]);
  const base = serializeCampaign(campaign);
  const tampered = { ...base, companionFormation: { "anchor-shard": "FRONT" } };
  assert.equal(restoreCampaign(tampered), null);
});

test("a valid current-shape campaign restores without modification", () => {
  const campaign = campaignWithElitesAndResolves("valid-roundtrip", {
    elites: [["e1", "ember-cohort"]],
    stages: ["cinder-span"],
  });
  const serialized = serializeCampaign(campaign);
  assert.deepEqual(restoreCampaign(serialized), campaign);
  assert.deepEqual(restoreCampaign(JSON.stringify(serialized)), campaign);
});
