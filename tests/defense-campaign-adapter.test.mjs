import assert from "node:assert/strict";
import test from "node:test";
import {
  STAGES,
  applyCampaignRunResult,
  captureElite,
  createCampaign,
  restoreCampaign,
  serializeCampaign,
  setCompanionLoadout,
  startRun
} from "../campaign-state.js";
import { DefenseStorage } from "../defense-storage.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

test("a resolved stage unlocks its successor only once", () => {
  let campaign = createCampaign({ campaignId: "unlock", resetEpoch: 4 });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });
  const duplicate = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });

  assert.equal(campaign.unlockedStageIndex, 1);
  assert.equal(duplicate.unlockedStageIndex, 1);
  assert.deepEqual(duplicate.resolvedIds, ["cinder-span"]);
  assert.equal(duplicate.attemptsByStage["cinder-span"], 1);
});

test("the final stage records campaign completion", () => {
  let campaign = createCampaign({ campaignId: "final" });
  for (const stage of STAGES.slice(0, -1)) {
    campaign = startRun(campaign, stage.id);
    campaign = applyCampaignRunResult(campaign, { stageId: stage.id, outcome: "victory" });
  }
  campaign = startRun(campaign, "gate-zenith");
  campaign = applyCampaignRunResult(campaign, { stageId: "gate-zenith", outcome: "FINAL_COMPLETION" });

  assert.equal(campaign.resolvedIds.length, STAGES.length);
  assert.deepEqual(campaign.lastResolution, {
    stageId: "gate-zenith",
    outcome: "FINAL_COMPLETION",
    campaignComplete: true
  });
});

test("capturing an elite evolves its canonical companion and validates loadouts", () => {
  let campaign = createCampaign({ campaignId: "companions" });
  campaign = captureElite(campaign, "s4-anchor-diver", "anchor-shard");
  const duplicate = captureElite(campaign, "s4-anchor-diver", "anchor-shard");
  campaign = captureElite(duplicate, "s7-toll-keeper", "anchor-shard");
  campaign = captureElite(campaign, "s5-pack-sentinel", "veil-vanguard");
  campaign = setCompanionLoadout(campaign, ["veil-vanguard", "anchor-shard"]);

  assert.deepEqual(campaign.companionCollection, [
    { prototype: "anchor-shard", evolution: 2, capturedEliteIds: ["s4-anchor-diver", "s7-toll-keeper"] },
    { prototype: "veil-vanguard", evolution: 1, capturedEliteIds: ["s5-pack-sentinel"] }
  ]);
  assert.deepEqual(campaign.companionLoadout, { prototypeIds: ["anchor-shard", "veil-vanguard"] });
  assert.throws(() => setCompanionLoadout(campaign, ["unknown"]), TypeError);
  assert.throws(() => setCompanionLoadout(campaign, ["anchor-shard", "anchor-shard"]), TypeError);
});

test("saved campaigns serialize and restore through the storage adapter", async () => {
  let campaign = createCampaign({ campaignId: "saved", resetEpoch: 2 });
  campaign = startRun(campaign);
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "defeat" });
  const storage = new DefenseStorage({ indexedDB: null, localStorage: memoryStorage(), crypto: null });

  assert.deepEqual(restoreCampaign(serializeCampaign(campaign)), campaign);
  await storage.save(campaign);
  assert.deepEqual(await storage.load(), campaign);
  const text = await storage.exportText();
  assert.equal(await storage.importText(text), true);
});

test("invalid campaign and storage imports are rejected without replacing the active state", async () => {
  const campaign = createCampaign({ campaignId: "active" });
  const storage = new DefenseStorage({ indexedDB: null, localStorage: memoryStorage(), crypto: null });
  await storage.save(campaign);

  assert.equal(restoreCampaign({ campaignId: "missing-fields" }), null);
  assert.equal(await storage.importText("{not json"), false);
  assert.deepEqual(await storage.load(), campaign);
});

test("restores legacy campaign payloads and round-trips the expanded schema", () => {
  let campaign = createCampaign({ campaignId: "migration", resetEpoch: 7 });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });

  const current = serializeCampaign(campaign);
  const legacy = { ...current };
  delete legacy.rewardIds;
  delete legacy.achievementIds;

  const migrated = restoreCampaign(legacy);
  assert.deepEqual(migrated, {
    ...legacy,
    rewardIds: [],
    achievementIds: [],
  });
  assert.deepEqual(restoreCampaign(JSON.stringify(legacy)), migrated);
  assert.deepEqual(restoreCampaign(serializeCampaign(migrated)), migrated);
});

test("victory without a reward selects the first authored stage reward", () => {
  let campaign = createCampaign({ campaignId: "default-reward" });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, { stageId: "cinder-span", outcome: "victory" });

  assert.deepEqual(campaign.rewardIds, ["ember-cohort-legacy"]);
  assert.deepEqual(campaign.achievementIds, ["stage-clear:cinder-span"]);
});

test("defeat never grants a supplied reward", () => {
  let campaign = createCampaign({ campaignId: "no-defeat-reward" });
  campaign = startRun(campaign, "cinder-span");
  campaign = applyCampaignRunResult(campaign, {
    stageId: "cinder-span",
    outcome: "defeat",
    rewardId: "ember-cohort-legacy",
  });

  assert.deepEqual(campaign.rewardIds, []);
  assert.deepEqual(campaign.achievementIds, []);
  assert.deepEqual(campaign.lastResolution, {
    stageId: "cinder-span",
    outcome: "defeat",
    campaignComplete: false,
  });
});

test("rejects a reward authored for another stage", () => {
  let campaign = createCampaign({ campaignId: "stage-reward-boundary" });
  campaign = startRun(campaign, "cinder-span");

  assert.throws(
    () => applyCampaignRunResult(campaign, {
      stageId: "cinder-span",
      outcome: "victory",
      rewardId: "rift-lens-archive",
    }),
    TypeError,
  );
});
