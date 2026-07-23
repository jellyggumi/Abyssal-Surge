import { COMPANIONS, REWARDS, STAGE_REWARD_IDS } from "./defense-catalog.js";
import {
  WARDEN_STATS, wardenStatTotalCost, WARDEN_SKILL_TREE,
  WARDEN_TRAITS, WARDEN_TRAIT_UNLOCK_SEQUENCES, wardenTraitOffersForSequence,
  EQUIPMENT_SLOTS, EQUIPMENT_TIERS, EQUIPMENT_TIER_UPGRADE_COST,
  MAX_FRONT_SLOTS, FORMATION_SLOTS, deriveWardenRuntimeStats, deriveCompanionRuntimeStats,
} from "./rpg-catalog.js";

export const RULES_VERSION = "defense-survivor-v1";
export const IDLE_RETURN_VERSION = 1;
export const IDLE_RETURN_INTERVAL_MS = 60_000;
export const IDLE_RETURN_MAX_ELAPSED_MS = 8 * 60 * 60 * 1000;
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
/** Warden equipment owner id — verified disjoint from every COMPANIONS prototype id. */
const WARDEN_OWNER_ID = "warden";
let campaignSequence = 0;
const fail = (message) => { throw new TypeError(message); };
const isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
const isPlainObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const hasOnlyKeys = (value, keys) => Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
const validIds = (ids) => Array.isArray(ids) && ids.every(isNonEmptyString) && new Set(ids).size === ids.length;
const canonicalPrototype = (prototype) => isNonEmptyString(prototype) && Object.hasOwn(COMPANIONS, prototype);
const isTimestamp = (value) => Number.isSafeInteger(value) && value >= 0;
function copyIdleReturn(idleReturn) {
  return { version: idleReturn.version, lastSettledAt: idleReturn.lastSettledAt, totalProgress: idleReturn.totalProgress };
}
function idleReceipt(outcome, { requestedAt = null, elapsedMs = 0, settledElapsedMs = 0, completedStages = 0, awardedProgress = 0, settledAt = null } = {}) {
  return Object.freeze({ outcome, requestedAt, elapsedMs, settledElapsedMs, completedStages, awardedProgress, settledAt });
}

// --- RPG layer (Solo Warden concept, `_workspace/20260723-solo-warden-rpg-concept/`) ---
const initialWardenProgress = () => ({ statPoints: {}, skillTreeIds: [], traitIds: [] });
function copyWardenProgress(wardenProgress) {
  return {
    statPoints: { ...wardenProgress.statPoints },
    skillTreeIds: [...wardenProgress.skillTreeIds],
    traitIds: [...wardenProgress.traitIds],
  };
}
function copyCompanionFormation(companionFormation) { return { ...companionFormation }; }

/** Echo Core earned so far: 1 per distinct captured elite id (elite extract, stage-capped at 10) + 3 per resolved stage (boss kill, capped at 30) — UNIFIED-GDD.md §3.2, campaign budget 40. */
export function echoCoreEarned(campaign) {
  const capturedEliteCount = Math.min(STAGES.length, new Set(campaign.companionCollection.flatMap((record) => record.capturedEliteIds)).size);
  return capturedEliteCount + campaign.resolvedIds.length * 3;
}
/** Bound Fragment earned so far: 1 per resolved stage (boss kill), max 10. */
export function boundFragmentEarned(campaign) { return campaign.resolvedIds.length; }
export function echoCoreSpent(campaign) {
  const statCost = Object.values(campaign.wardenProgress.statPoints).reduce((sum, points) => sum + wardenStatTotalCost(points), 0);
  const skillCost = campaign.wardenProgress.skillTreeIds.reduce((sum, id) => sum + (WARDEN_SKILL_TREE[id]?.cost ?? 0), 0);
  return statCost + skillCost;
}
export function boundFragmentSpent(campaign) {
  return campaign.ownedEquipmentIds.reduce((sum, id) => {
    const stepIndex = Number(id.split(":")[2]);
    return sum + (EQUIPMENT_TIER_UPGRADE_COST[stepIndex] ?? 0);
  }, 0);
}
/** 0-based tier index (0=T1 baseline .. 4=T5) currently owned for an owner+slot pair. */
export function equipmentTierIndexFor(campaign, ownerId, slot) {
  const prefix = `${ownerId}:${slot}:`;
  return campaign.ownedEquipmentIds.filter((id) => id.startsWith(prefix)).length;
}
function equipmentTiersFor(campaign, ownerId) {
  return Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipmentTierIndexFor(campaign, ownerId, slot)]));
}
export function wardenRuntimeStatsForCampaign(campaign) {
  return deriveWardenRuntimeStats({ ...campaign.wardenProgress, equipment: equipmentTiersFor(campaign, WARDEN_OWNER_ID) });
}
export function companionRuntimeStatsForCampaign(campaign, companionId) {
  return deriveCompanionRuntimeStats(companionId, { equipment: equipmentTiersFor(campaign, companionId) });
}
/** FRONT/BACK slot for a loadout companion; defaults to BACK when unassigned (legacy-compatible, matches formation-sim §4.2). */
export function companionFormationSlot(campaign, prototypeId) { return campaign.companionFormation[prototypeId] || "BACK"; }

function validWardenProgress(campaign, wardenProgress) {
  if (!isPlainObject(wardenProgress) || !hasOnlyKeys(wardenProgress, ["statPoints", "skillTreeIds", "traitIds"])) return false;
  if (!isPlainObject(wardenProgress.statPoints)) return false;
  if (!Object.entries(wardenProgress.statPoints).every(([statId, points]) => Object.hasOwn(WARDEN_STATS, statId) && Number.isInteger(points) && points >= 0 && points <= WARDEN_STATS[statId].maxPoints)) return false;
  if (!validIds(wardenProgress.skillTreeIds) || !wardenProgress.skillTreeIds.every((id) => Object.hasOwn(WARDEN_SKILL_TREE, id) && WARDEN_SKILL_TREE[id].prereq.every((prereqId) => wardenProgress.skillTreeIds.includes(prereqId)))) return false;
  if (!validIds(wardenProgress.traitIds) || wardenProgress.traitIds.length > WARDEN_TRAIT_UNLOCK_SEQUENCES.length || !wardenProgress.traitIds.every((id) => Object.hasOwn(WARDEN_TRAITS, id))) return false;
  const statCost = Object.entries(wardenProgress.statPoints).reduce((sum, [, points]) => sum + wardenStatTotalCost(points), 0);
  const skillCost = wardenProgress.skillTreeIds.reduce((sum, id) => sum + WARDEN_SKILL_TREE[id].cost, 0);
  return statCost + skillCost <= echoCoreEarned(campaign);
}
function validOwnedEquipmentIds(campaign, ownedEquipmentIds) {
  if (!validIds(ownedEquipmentIds)) return false;
  const owners = new Set([WARDEN_OWNER_ID, ...campaign.companionCollection.map((record) => record.prototype)]);
  const stepsByKey = new Map();
  for (const id of ownedEquipmentIds) {
    const parts = id.split(":");
    if (parts.length !== 3) return false;
    const [ownerId, slot, stepText] = parts;
    if (!owners.has(ownerId) || !EQUIPMENT_SLOTS.includes(slot)) return false;
    const step = Number(stepText);
    if (!Number.isInteger(step) || String(step) !== stepText || step < 0 || step >= EQUIPMENT_TIER_UPGRADE_COST.length) return false;
    const key = `${ownerId}:${slot}`;
    if (!stepsByKey.has(key)) stepsByKey.set(key, new Set());
    stepsByKey.get(key).add(step);
  }
  for (const steps of stepsByKey.values()) {
    for (let i = 0; i < steps.size; i += 1) if (!steps.has(i)) return false; // contiguous from 0, no gaps
  }
  const totalCost = ownedEquipmentIds.reduce((sum, id) => sum + EQUIPMENT_TIER_UPGRADE_COST[Number(id.split(":")[2])], 0);
  return totalCost <= boundFragmentEarned(campaign);
}
function validCompanionFormation(campaign, companionFormation) {
  if (!isPlainObject(companionFormation)) return false;
  const entries = Object.entries(companionFormation);
  if (!entries.every(([prototype, slot]) => campaign.companionLoadout.prototypeIds.includes(prototype) && FORMATION_SLOTS.includes(slot))) return false;
  return entries.filter(([, slot]) => slot === "FRONT").length <= MAX_FRONT_SLOTS;
}

function copyCampaign(campaign) {
  return {
    campaignId: campaign.campaignId, resetEpoch: campaign.resetEpoch, unlockedStageIndex: campaign.unlockedStageIndex,
    companionCollection: campaign.companionCollection.map((record) => ({ prototype: record.prototype, evolution: record.evolution, capturedEliteIds: [...record.capturedEliteIds] })),
    companionLoadout: { prototypeIds: [...campaign.companionLoadout.prototypeIds] },
    resolvedIds: [...campaign.resolvedIds], attemptsByStage: { ...campaign.attemptsByStage },
    rewardIds: [...(campaign.rewardIds ?? [])], achievementIds: [...(campaign.achievementIds ?? [])],
    idleReturn: copyIdleReturn(campaign.idleReturn ?? initialIdleReturn()),
    lastResolution: campaign.lastResolution ? { ...campaign.lastResolution } : null,
    wardenProgress: copyWardenProgress(campaign.wardenProgress ?? initialWardenProgress()),
    ownedEquipmentIds: [...(campaign.ownedEquipmentIds ?? [])],
    companionFormation: copyCompanionFormation(campaign.companionFormation ?? {}),
  };
}
const LEGACY_KEYS = ["campaignId", "resetEpoch", "unlockedStageIndex", "companionCollection", "companionLoadout", "resolvedIds", "attemptsByStage", "lastResolution"];
const REWARD_KEYS = [...LEGACY_KEYS, "rewardIds", "achievementIds"];
const IDLE_KEYS = [...REWARD_KEYS, "idleReturn"];
const CURRENT_KEYS = [...IDLE_KEYS, "wardenProgress", "ownedEquipmentIds", "companionFormation"];
const initialIdleReturn = () => ({ version: IDLE_RETURN_VERSION, lastSettledAt: null, totalProgress: 0 });
function migrateCampaign(value) {
  if (!isPlainObject(value)) return value;
  if (!LEGACY_KEYS.every((key) => Object.hasOwn(value, key))) return value; // baseline fields are required, never migrated
  const patch = {};
  if (!Object.hasOwn(value, "rewardIds")) patch.rewardIds = [];
  if (!Object.hasOwn(value, "achievementIds")) patch.achievementIds = [];
  if (!Object.hasOwn(value, "idleReturn")) patch.idleReturn = initialIdleReturn();
  if (!Object.hasOwn(value, "wardenProgress")) patch.wardenProgress = initialWardenProgress();
  if (!Object.hasOwn(value, "ownedEquipmentIds")) patch.ownedEquipmentIds = [];
  if (!Object.hasOwn(value, "companionFormation")) patch.companionFormation = {};
  return Object.keys(patch).length ? { ...value, ...patch } : value;
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
  if (!isPlainObject(candidate.idleReturn) || !hasOnlyKeys(candidate.idleReturn, ["version", "lastSettledAt", "totalProgress"]) || candidate.idleReturn.version !== IDLE_RETURN_VERSION || (candidate.idleReturn.lastSettledAt !== null && !isTimestamp(candidate.idleReturn.lastSettledAt)) || !isTimestamp(candidate.idleReturn.totalProgress)) return false;
  if (candidate.lastResolution !== null && !(isPlainObject(candidate.lastResolution) && hasOnlyKeys(candidate.lastResolution, ["stageId", "outcome", "campaignComplete"]) && STAGE_INDEX.has(candidate.lastResolution.stageId) && ["victory", "defeat", "FINAL_COMPLETION"].includes(candidate.lastResolution.outcome) && typeof candidate.lastResolution.campaignComplete === "boolean")) return false;
  if (!validWardenProgress(candidate, candidate.wardenProgress)) return false;
  if (!validOwnedEquipmentIds(candidate, candidate.ownedEquipmentIds)) return false;
  return validCompanionFormation(candidate, candidate.companionFormation);
}
function requireCampaign(campaign) { if (!validCampaign(campaign)) fail("Invalid defense campaign."); }

export function createCampaign({ campaignId, resetEpoch = 0 } = {}) {
  if (!Number.isInteger(resetEpoch) || resetEpoch < 0) fail("resetEpoch must be a non-negative integer.");
  const id = campaignId ?? `defense-${resetEpoch}-${++campaignSequence}`;
  if (!isNonEmptyString(id)) fail("campaignId must be a non-empty string.");
  return {
    campaignId: id, resetEpoch, unlockedStageIndex: 0, companionCollection: [], companionLoadout: { prototypeIds: [] },
    resolvedIds: [], attemptsByStage: {}, rewardIds: [], achievementIds: [], idleReturn: initialIdleReturn(), lastResolution: null,
    wardenProgress: initialWardenProgress(), ownedEquipmentIds: [], companionFormation: {},
  };
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

/** Farwatch Hold ward level (balance-sheet.md undertow-encroachment): resolvedIds.length + floor(companionCollection.length / 2). Auto-derived, no separate investment resource. */
export function wardLevel(campaign) { return campaign.resolvedIds.length + Math.floor(campaign.companionCollection.length / 2); }
/** Wardline pressure this settlement window (1/hour, capped at 8h — reuses IDLE_RETURN_MAX_ELAPSED_MS). */
function wardlinePressure(elapsedMs) { return Math.min(Math.floor(elapsedMs / (60 * IDLE_RETURN_INTERVAL_MS)), 8); }
export function settleIdleReturn(campaign, { now } = {}) {
  requireCampaign(campaign);
  const next = copyCampaign(campaign);
  if (!isTimestamp(now)) return { campaign: next, receipt: idleReceipt("INVALID_TIME") };
  const lastSettledAt = next.idleReturn.lastSettledAt;
  if (lastSettledAt === null) {
    next.idleReturn.lastSettledAt = now;
    return { campaign: next, receipt: idleReceipt("INITIALIZED", { requestedAt: now, settledAt: now }) };
  }
  if (now < lastSettledAt) return { campaign: next, receipt: idleReceipt("INVALID_TIME", { requestedAt: now }) };
  const elapsedMs = now - lastSettledAt;
  if (elapsedMs < IDLE_RETURN_INTERVAL_MS) return { campaign: next, receipt: idleReceipt("EARLY", { requestedAt: now, elapsedMs }) };
  const settledElapsedMs = Math.min(elapsedMs, IDLE_RETURN_MAX_ELAPSED_MS);
  const completedStages = next.resolvedIds.length;
  next.idleReturn.lastSettledAt = now;
  if (completedStages === 0) {
    return { campaign: next, receipt: idleReceipt("NO_COMPLETED_STAGES", { requestedAt: now, elapsedMs, settledElapsedMs, settledAt: now }) };
  }
  const pressure = wardlinePressure(elapsedMs);
  const level = wardLevel(next);
  if (pressure > level) {
    return { campaign: next, receipt: idleReceipt("ENCROACHED", { requestedAt: now, elapsedMs, settledElapsedMs, completedStages, settledAt: now }) };
  }
  const awardedProgress = completedStages * Math.floor(settledElapsedMs / IDLE_RETURN_INTERVAL_MS);
  if (!Number.isSafeInteger(next.idleReturn.totalProgress + awardedProgress)) {
    return { campaign: copyCampaign(campaign), receipt: idleReceipt("CAPACITY_REACHED", { requestedAt: now, elapsedMs, settledElapsedMs, completedStages }) };
  }
  next.idleReturn.totalProgress += awardedProgress;
  return { campaign: next, receipt: idleReceipt("SETTLED", { requestedAt: now, elapsedMs, settledElapsedMs, completedStages, awardedProgress, settledAt: now }) };
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
  next.companionFormation = Object.fromEntries(Object.entries(next.companionFormation).filter(([prototype]) => prototypeIds.includes(prototype)));
  return next;
}

/** Sets a loadout companion's FRONT/BACK slot. Omitting a companion (or `slot=null`) defaults it to BACK. Max 2 FRONT (UNIFIED-GDD.md §4.2). */
export function setCompanionFormationSlot(campaign, prototypeId, slot) {
  requireCampaign(campaign);
  if (!campaign.companionLoadout.prototypeIds.includes(prototypeId)) fail("Companion must be in the current loadout.");
  if (slot !== null && !FORMATION_SLOTS.includes(slot)) fail("slot must be FRONT, BACK, or null.");
  const next = copyCampaign(campaign);
  if (slot === null || slot === "BACK") delete next.companionFormation[prototypeId];
  else {
    const frontCount = Object.entries(next.companionFormation).filter(([id, s]) => s === "FRONT" && id !== prototypeId).length;
    if (frontCount >= MAX_FRONT_SLOTS) fail(`At most ${MAX_FRONT_SLOTS} companions may be FRONT.`);
    next.companionFormation[prototypeId] = "FRONT";
  }
  return next;
}

/** Allocates one point in a Track A stat (Echo Core spend gated by echoCoreEarned budget). */
export function allocateWardenStatPoint(campaign, statId) {
  requireCampaign(campaign);
  if (!Object.hasOwn(WARDEN_STATS, statId)) fail("Unknown Warden stat.");
  const current = campaign.wardenProgress.statPoints[statId] ?? 0;
  if (current >= WARDEN_STATS[statId].maxPoints) fail("Stat is already at max points.");
  const next = copyCampaign(campaign);
  next.wardenProgress.statPoints[statId] = current + 1;
  if (echoCoreSpent(next) > echoCoreEarned(next)) fail("Not enough Echo Core.");
  return next;
}
/** Unlocks one Track A skill-tree node (prerequisites + Echo Core budget enforced). */
export function unlockWardenSkillNode(campaign, nodeId) {
  requireCampaign(campaign);
  if (!Object.hasOwn(WARDEN_SKILL_TREE, nodeId)) fail("Unknown skill-tree node.");
  if (campaign.wardenProgress.skillTreeIds.includes(nodeId)) fail("Node is already unlocked.");
  const node = WARDEN_SKILL_TREE[nodeId];
  if (!node.prereq.every((prereqId) => campaign.wardenProgress.skillTreeIds.includes(prereqId))) fail("Prerequisite node(s) not unlocked.");
  const next = copyCampaign(campaign);
  next.wardenProgress.skillTreeIds.push(nodeId);
  next.wardenProgress.skillTreeIds.sort();
  if (echoCoreSpent(next) > echoCoreEarned(next)) fail("Not enough Echo Core.");
  return next;
}
/** Selects a Warden trait for the next open unlock sequence (stage-clear count 2/4/6/8/10); must be one of that sequence's 3 offers. */
export function selectWardenTrait(campaign, traitId) {
  requireCampaign(campaign);
  const nextSequenceSlot = campaign.wardenProgress.traitIds.length;
  if (nextSequenceSlot >= WARDEN_TRAIT_UNLOCK_SEQUENCES.length) fail("All trait unlock sequences are already resolved.");
  const sequenceNumber = WARDEN_TRAIT_UNLOCK_SEQUENCES[nextSequenceSlot];
  if (campaign.resolvedIds.length < sequenceNumber) fail(`Trait unlocks at ${sequenceNumber} cleared stages.`);
  const offers = wardenTraitOffersForSequence(sequenceNumber, campaign.wardenProgress.traitIds);
  if (campaign.wardenProgress.traitIds.includes(traitId)) fail("Trait is already owned.");
  if (!offers.includes(traitId)) fail("traitId must be one of the offered traits for this unlock sequence.");
  const next = copyCampaign(campaign);
  next.wardenProgress.traitIds.push(traitId);
  return next;
}
/** Advances one equipment slot by one tier for `ownerId` ("warden" or an owned companion prototype); Bound Fragment budget enforced. */
export function purchaseEquipmentTier(campaign, ownerId, slot) {
  requireCampaign(campaign);
  if (ownerId !== WARDEN_OWNER_ID && !campaign.companionCollection.some((record) => record.prototype === ownerId)) fail("ownerId must be \"warden\" or an owned companion.");
  if (!EQUIPMENT_SLOTS.includes(slot)) fail("Unknown equipment slot.");
  const step = equipmentTierIndexFor(campaign, ownerId, slot);
  if (step >= EQUIPMENT_TIERS.length - 1) fail("Slot is already at max tier.");
  const next = copyCampaign(campaign);
  next.ownedEquipmentIds.push(`${ownerId}:${slot}:${step}`);
  next.ownedEquipmentIds.sort();
  if (boundFragmentSpent(next) > boundFragmentEarned(next)) fail("Not enough Bound Fragment.");
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
