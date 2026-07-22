import { COMPANIONS, REWARDS, STAGE_REWARD_IDS } from "./defense-catalog.js";

export const RULES_VERSION = "defense-survivor-v1";
export const STAGES = Object.freeze([
  Object.freeze({ id: "cinder-span", name: "Cinder Span", bossName: "Cinder Warden", sequence: 1 }),
  Object.freeze({ id: "veil-citadel", name: "Veil Citadel", bossName: "Veil Tactician", sequence: 2 }),
  Object.freeze({ id: "echo-throne", name: "Echo Throne", bossName: "Gate Sovereign", sequence: 3 }),
  Object.freeze({ id: "sunken-bastion", name: "Sunken Bastion", bossName: "Tide Warden", sequence: 4 }),
  Object.freeze({ id: "howling-sprawl", name: "Howling Sprawl", bossName: "Pack Herald", sequence: 5 }),
  Object.freeze({ id: "glass-necropolis", name: "Glass Necropolis", bossName: "Requiem Choir", sequence: 6 }),
  Object.freeze({ id: "starless-canal", name: "Starless Canal", bossName: "Lantern Tyrant", sequence: 7 }),
  Object.freeze({ id: "shattered-causeway", name: "Shattered Causeway", bossName: "Bridge Colossus", sequence: 8 }),
  Object.freeze({ id: "abyss-chancel", name: "Abyss Chancel", bossName: "Veiled Concordat", sequence: 9 }),
  Object.freeze({ id: "gate-zenith", name: "Gate Zenith", bossName: "Abyss Regent", sequence: 10 }),
]);
const STAGE_INDEX = new Map(STAGES.map((stage, index) => [stage.id, index]));
const MAX_LOADOUT_SIZE = 3;
let campaignSequence = 0;
const fail = (message) => { throw new TypeError(message); };
const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const hasOnlyKeys = (value, keys) => Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const validIds = (ids) => Array.isArray(ids) && ids.every(isNonEmptyString) && new Set(ids).size === ids.length;
const canonicalPrototype = (prototype) => isNonEmptyString(prototype) && Object.hasOwn(COMPANIONS, prototype);
function copyCampaign(campaign) {
  return {
    campaignId: campaign.campaignId, resetEpoch: campaign.resetEpoch, unlockedStageIndex: campaign.unlockedStageIndex,
    companionCollection: campaign.companionCollection.map((record) => ({ prototype: record.prototype, evolution: record.evolution, capturedEliteIds: [...record.capturedEliteIds] })),
    companionLoadout: { prototypeIds: [...campaign.companionLoadout.prototypeIds] },
    resolvedIds: [...campaign.resolvedIds], attemptsByStage: { ...campaign.attemptsByStage },
    rewardIds: [...(campaign.rewardIds ?? [])], achievementIds: [...(campaign.achievementIds ?? [])],
    lastResolution: campaign.lastResolution ? { ...campaign.lastResolution } : null,
  };
}
const LEGACY_KEYS = ["campaignId", "resetEpoch", "unlockedStageIndex", "companionCollection", "companionLoadout", "resolvedIds", "attemptsByStage", "lastResolution"];
const CURRENT_KEYS = [...LEGACY_KEYS, "rewardIds", "achievementIds"];
function migrateCampaign(value) {
  if (!isPlainObject(value) || !hasOnlyKeys(value, LEGACY_KEYS)) return value;
  return { ...value, rewardIds: [], achievementIds: [] };
}
function validCampaign(value) {
  const candidate = migrateCampaign(value);
  if (!isPlainObject(candidate) || !hasOnlyKeys(candidate, CURRENT_KEYS)) return false;
  if (!isNonEmptyString(candidate.campaignId) || !Number.isInteger(candidate.resetEpoch) || candidate.resetEpoch < 0 || !Number.isInteger(candidate.unlockedStageIndex) || candidate.unlockedStageIndex < 0 || candidate.unlockedStageIndex >= STAGES.length) return false;
  if (!Array.isArray(candidate.companionCollection) || !candidate.companionCollection.every((record) => isPlainObject(record) && hasOnlyKeys(record, ["prototype", "evolution", "capturedEliteIds"]) && canonicalPrototype(record.prototype) && Number.isInteger(record.evolution) && record.evolution >= 1 && record.evolution <= 3 && validIds(record.capturedEliteIds))) return false;
  const prototypes = candidate.companionCollection.map((record) => record.prototype);
  if (new Set(prototypes).size !== prototypes.length || !isPlainObject(candidate.companionLoadout) || !hasOnlyKeys(candidate.companionLoadout, ["prototypeIds"]) || !validIds(candidate.companionLoadout.prototypeIds) || candidate.companionLoadout.prototypeIds.length > MAX_LOADOUT_SIZE || !candidate.companionLoadout.prototypeIds.every((prototype) => prototypes.includes(prototype))) return false;
  if (!validIds(candidate.resolvedIds) || !candidate.resolvedIds.every((id) => STAGE_INDEX.has(id)) || !isPlainObject(candidate.attemptsByStage) || !Object.entries(candidate.attemptsByStage).every(([id, attempts]) => STAGE_INDEX.has(id) && Number.isInteger(attempts) && attempts >= 0)) return false;
  if (!validIds(candidate.rewardIds) || !candidate.rewardIds.every((id) => Object.hasOwn(REWARDS, id)) || !validIds(candidate.achievementIds)) return false;
  return candidate.lastResolution === null || (isPlainObject(candidate.lastResolution) && hasOnlyKeys(candidate.lastResolution, ["stageId", "outcome", "campaignComplete"]) && STAGE_INDEX.has(candidate.lastResolution.stageId) && ["victory", "defeat", "FINAL_COMPLETION"].includes(candidate.lastResolution.outcome) && typeof candidate.lastResolution.campaignComplete === "boolean");
}
function requireCampaign(campaign) { if (!validCampaign(campaign)) fail("Invalid defense campaign."); }

export function createCampaign({ campaignId, resetEpoch = 0 } = {}) {
  if (!Number.isInteger(resetEpoch) || resetEpoch < 0) fail("resetEpoch must be a non-negative integer.");
  const id = campaignId ?? `defense-${resetEpoch}-${++campaignSequence}`;
  if (!isNonEmptyString(id)) fail("campaignId must be a non-empty string.");
  return { campaignId: id, resetEpoch, unlockedStageIndex: 0, companionCollection: [], companionLoadout: { prototypeIds: [] }, resolvedIds: [], attemptsByStage: {}, rewardIds: [], achievementIds: [], lastResolution: null };
}
export function startRun(campaign, stageId = STAGES[campaign?.unlockedStageIndex]?.id) {
  requireCampaign(campaign);
  const stageIndex = STAGE_INDEX.get(stageId);
  if (stageIndex === undefined || stageIndex > campaign.unlockedStageIndex) fail("Stage is not unlocked.");
  const next = copyCampaign(campaign);
  next.attemptsByStage[stageId] = (next.attemptsByStage[stageId] ?? 0) + 1;
  return next;
}
export function applyCampaignRunResult(campaign, { stageId, outcome, rewardId = null } = {}) {
  requireCampaign(campaign);
  const stageIndex = STAGE_INDEX.get(stageId);
  if (stageIndex === undefined || stageIndex > campaign.unlockedStageIndex) fail("Stage is not unlocked.");
  if (!["victory", "defeat", "FINAL_COMPLETION"].includes(outcome)) fail("Run outcome must be victory, defeat, or FINAL_COMPLETION.");
  const next = copyCampaign(campaign);
  const victory = outcome === "victory" || outcome === "FINAL_COMPLETION";
  const authoredRewards = STAGE_REWARD_IDS[stageId] ?? [];
  const effectiveRewardId = victory ? (rewardId ?? authoredRewards[0] ?? null) : null;
  if (effectiveRewardId !== null && (!isNonEmptyString(effectiveRewardId) || !Object.hasOwn(REWARDS, effectiveRewardId) || !authoredRewards.includes(effectiveRewardId))) fail("Reward must be authored for this stage.");
  if (victory && !next.resolvedIds.includes(stageId)) {
    next.resolvedIds.push(stageId);
    next.resolvedIds.sort();
    next.unlockedStageIndex = Math.max(next.unlockedStageIndex, Math.min(stageIndex + 1, STAGES.length - 1));
  }
  if (victory && !next.achievementIds.includes(`stage-clear:${stageId}`)) next.achievementIds.push(`stage-clear:${stageId}`);
  if (effectiveRewardId !== null && !next.rewardIds.includes(effectiveRewardId)) next.rewardIds.push(effectiveRewardId);
  next.achievementIds.sort();
  next.rewardIds.sort();
  next.lastResolution = { stageId, outcome, campaignComplete: victory && stageIndex === STAGES.length - 1 && next.resolvedIds.includes(stageId) };
  return next;
}
export function captureElite(campaign, eliteId, prototype) {
  requireCampaign(campaign);
  if (!isNonEmptyString(eliteId) || !canonicalPrototype(prototype)) fail("eliteId and prototype must be canonical non-empty strings.");
  const next = copyCampaign(campaign);
  let record = next.companionCollection.find((entry) => entry.prototype === prototype);
  if (!record) {
    record = { prototype, evolution: 1, capturedEliteIds: [eliteId] };
    next.companionCollection.push(record);
    next.companionCollection.sort((left, right) => left.prototype.localeCompare(right.prototype));
  } else if (!record.capturedEliteIds.includes(eliteId)) {
    record.capturedEliteIds.push(eliteId);
    record.capturedEliteIds.sort();
    record.evolution = Math.min(3, record.evolution + 1);
  }
  return next;
}
export function setCompanionLoadout(campaign, prototypeIds) {
  requireCampaign(campaign);
  if (!validIds(prototypeIds) || prototypeIds.length > MAX_LOADOUT_SIZE || !prototypeIds.every((prototype) => campaign.companionCollection.some((record) => record.prototype === prototype))) fail("Loadout must contain up to three owned canonical companions.");
  const next = copyCampaign(campaign);
  next.companionLoadout.prototypeIds = [...prototypeIds].sort();
  return next;
}
export function serializeCampaign(campaign) {
  requireCampaign(campaign);
  return copyCampaign(campaign);
}
export function restoreCampaign(serialized) {
  let value = serialized;
  if (typeof serialized === "string") {
    try { value = JSON.parse(serialized); } catch { return null; }
  }
  return validCampaign(value) ? copyCampaign(value) : null;
}
