#!/usr/bin/env node
// Stage2 QA archetype-rotation sweep runner (game-studio-harness). Drives one archetype's
// full-campaign investment policy across seeds 301/302/303 and writes per-seed stage results.
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  createCampaign, startRun, applyCampaignRunResult, captureElite, setCompanionLoadout,
  setCompanionFormationSlot, allocateWardenStatPoint, unlockWardenSkillNode, selectWardenTrait,
  purchaseEquipmentTier, echoCoreEarned, wardLevel, equipmentTierIndexFor, STAGES,
} from "../campaign-state.js";
import { createDefenseRun, advanceDefenseRun, isTerminalRun, queueInput } from "../defense-run-simulation.js";
import { WARDEN_STATS, WARDEN_SKILL_TREE, WARDEN_TRAIT_UNLOCK_SEQUENCES, wardenTraitOffersForSequence, EQUIPMENT_SLOTS } from "../rpg-catalog.js";
import { STAGE_BY_ID } from "../defense-catalog.js";

function mulberry32(seed) {
  let t = seed;
  return () => {
    t |= 0; t = (t + 0x6D2B79F5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const ARCHETYPES = {
  rusher: { statPriority: ["binding-might", "fracture-precision", "abyssal-resonance", "echo-swiftness", "gate-resolve", "reclaim-radius"], skillPriority: ["echo-backlash", "echo-cascade", "wardens-ward", "wardens-vigil", "echo-warden-awakening"], traitPreference: (offers) => offers.find((id) => ["first-strike", "elite-hunter", "chain-reaction"].includes(id)) || offers[0], loadoutPreference: ["ember-cohort", "rift-lens"], formationAggro: true },
  turtle: { statPriority: ["gate-resolve", "echo-swiftness", "fracture-precision", "binding-might", "abyssal-resonance", "reclaim-radius"], skillPriority: ["wardens-ward", "wardens-vigil", "echo-backlash", "echo-cascade", "echo-warden-awakening"], traitPreference: (offers) => offers.find((id) => ["gate-keeper", "companions-wardpact"].includes(id)) || offers[0], loadoutPreference: ["anchor-shard", "veil-vanguard"], formationAggro: false },
  "economy-greed": { statPriority: ["reclaim-radius", "echo-swiftness", "binding-might", "gate-resolve", "fracture-precision", "abyssal-resonance"], skillPriority: ["echo-backlash", "wardens-ward", "echo-cascade", "wardens-vigil", "echo-warden-awakening"], traitPreference: (offers) => offers.find((id) => id === "reckless-reclaim") || offers[0], loadoutPreference: ["throne-echo", "dawnless-crown"], formationAggro: false, equipmentFirst: true },
  "micro-optimizer": { statPriority: ["binding-might", "gate-resolve", "abyssal-resonance", "fracture-precision", "echo-swiftness", "reclaim-radius"], skillPriority: ["echo-backlash", "wardens-ward", "echo-cascade", "wardens-vigil", "echo-warden-awakening"], traitPreference: (offers, rng) => offers[Math.floor(rng() * offers.length)], loadoutPreference: ["ember-cohort", "anchor-shard", "throne-echo"], formationAggro: true },
  casual: { statPriority: null, skillPriority: null, traitPreference: (offers, rng) => offers[Math.floor(rng() * offers.length)], loadoutPreference: null, formationAggro: false, skipRate: 0.3 },
  "completionist-collector": { statPriority: "even", skillPriority: ["echo-backlash", "wardens-ward", "echo-cascade", "wardens-vigil", "echo-warden-awakening"], traitPreference: (offers) => offers[0], loadoutPreference: "rotate", formationAggro: true, equipmentSpread: true },
  "single-companion-main": { statPriority: ["binding-might", "abyssal-resonance", "fracture-precision", "gate-resolve", "echo-swiftness", "reclaim-radius"], skillPriority: ["echo-backlash", "echo-cascade", "wardens-ward", "wardens-vigil", "echo-warden-awakening"], traitPreference: (offers) => offers.find((id) => ["elite-hunter", "chain-reaction", "first-strike"].includes(id)) || offers[0], loadoutPreference: ["ember-cohort"], singleCompanionOnly: true, formationAggro: true, equipmentFirst: true },
};

function queueObjectiveCommands(run) {
  if (run.growthOffer) return queueInput(run, "SKILL_SELECTED", { skillId: run.growthOffer.choices[0] });
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of run.commander.skills) next = queueInput(next, "SKILL_CAST", { skillId });
  if (run.eliteCandidate && !run.extracted) next = queueInput(next, "EXTRACT_ELITE", { enemyId: run.eliteCandidate.enemyId });
  return next;
}
function driveBattleToTerminal(run, maxSteps = 20000) {
  let r = run; let bossSpawnedAt = null;
  for (let step = 0; step < maxSteps && !isTerminalRun(r); step += 1) { r = advanceDefenseRun(queueObjectiveCommands(r), 1); if (r.bossSpawned && bossSpawnedAt === null) bossSpawnedAt = r.tick; }
  return { terminal: r.terminal, run: r, ticksUsed: r.tick, bossTtkTicks: bossSpawnedAt !== null ? r.tick - bossSpawnedAt : null };
}
function applyLoadoutPolicy(campaign, policy, rng) {
  let c = campaign; const owned = c.companionCollection.map((r) => r.prototype); let desired;
  if (policy.singleCompanionOnly) desired = owned.includes(policy.loadoutPreference[0]) ? [policy.loadoutPreference[0]] : [];
  else if (policy.loadoutPreference === "rotate") desired = owned.slice(0, 3);
  else if (policy.loadoutPreference === null) desired = owned.slice(0, 3).sort(() => rng() - 0.5);
  else { const preferred = policy.loadoutPreference.filter((id) => owned.includes(id)); const rest = owned.filter((id) => !preferred.includes(id)); desired = [...preferred, ...rest].slice(0, 3); }
  try { c = setCompanionLoadout(c, desired); } catch {}
  if (policy.formationAggro && desired.length) { try { c = setCompanionFormationSlot(c, desired[0], "FRONT"); } catch {} }
  return c;
}
function applyPolicyInvestments(campaign, policy, rng) {
  let c = campaign;
  const affordStat = (statId) => { const points = c.wardenProgress.statPoints[statId] ?? 0; if (points >= WARDEN_STATS[statId].maxPoints) return false; try { c = allocateWardenStatPoint(c, statId); return true; } catch { return false; } };
  const affordSkill = (nodeId) => { if (c.wardenProgress.skillTreeIds.includes(nodeId)) return false; try { c = unlockWardenSkillNode(c, nodeId); return true; } catch { return false; } };
  const affordEquip = (ownerId, slot) => { try { c = purchaseEquipmentTier(c, ownerId, slot); return true; } catch { return false; } };
  if (!policy.equipmentFirst) { let progressed = true; while (progressed) { progressed = false; if (policy.statPriority === "even") { for (const statId of Object.keys(WARDEN_STATS)) { if (affordStat(statId)) { progressed = true; break; } } } else if (Array.isArray(policy.statPriority)) { for (const statId of policy.statPriority) { if (affordStat(statId)) { progressed = true; break; } } } else { const ids = Object.keys(WARDEN_STATS); const pick = ids[Math.floor(rng() * ids.length)]; if (rng() > (policy.skipRate ?? 0) && affordStat(pick)) progressed = true; } } }
  { let progressed = true; while (progressed) { progressed = false; const order = policy.skillPriority || Object.keys(WARDEN_SKILL_TREE).sort(() => rng() - 0.5); for (const nodeId of order) { if (affordSkill(nodeId)) { progressed = true; break; } } } }
  if (policy.equipmentFirst) { let progressed = true; while (progressed) { progressed = false; const owners = policy.singleCompanionOnly ? c.companionLoadout.prototypeIds : ["warden", ...c.companionLoadout.prototypeIds]; for (const ownerId of owners) { for (const slot of EQUIPMENT_SLOTS) { if (affordEquip(ownerId, slot)) { progressed = true; break; } } if (progressed) break; } } let progressed2 = true; while (progressed2) { progressed2 = false; const order = Array.isArray(policy.statPriority) ? policy.statPriority : Object.keys(WARDEN_STATS); for (const statId of order) { if (affordStat(statId)) { progressed2 = true; break; } } } }
  else if (policy.equipmentSpread) { let progressed = true; while (progressed) { progressed = false; const owners = ["warden", ...c.companionLoadout.prototypeIds]; for (const ownerId of owners) { for (const slot of EQUIPMENT_SLOTS) { if (affordEquip(ownerId, slot)) { progressed = true; break; } } } } }
  else { let progressed = true; while (progressed) { progressed = affordEquip("warden", "weapon"); } }
  const nextSlot = c.wardenProgress.traitIds.length; const nextSeq = WARDEN_TRAIT_UNLOCK_SEQUENCES[nextSlot];
  if (nextSeq !== undefined && c.resolvedIds.length >= nextSeq) { const offers = wardenTraitOffersForSequence(nextSeq, c.wardenProgress.traitIds); const chosen = policy.traitPreference(offers, rng); try { c = selectWardenTrait(c, chosen); } catch (e) { console.error("trait select failed:", e.message); } }
  return c;
}
function runArchetypeCampaign(archetypeId, seed, maxStagesForSpeed = 10) {
  const policy = ARCHETYPES[archetypeId]; const rng = mulberry32(seed * 7919 + archetypeId.length);
  let campaign = createCampaign({ campaignId: `${archetypeId}-${seed}` }); const stageResults = [];
  for (const stage of STAGES.slice(0, maxStagesForSpeed)) {
    const stageIndex = STAGES.findIndex(s => s.id === stage.id);
    if (stageIndex > campaign.unlockedStageIndex) break;
    campaign = startRun(campaign, stage.id);
    const equipTiers = (ownerId) => Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, equipmentTierIndexFor(campaign, ownerId, slot)]));
    const loadout = campaign.companionLoadout.prototypeIds;
    let run = createDefenseRun({ stageId: stage.id, seed: seed * 1000 + stageIndex, companionLoadout: loadout, rewardIds: campaign.rewardIds, wardenProgress: campaign.wardenProgress, wardenEquipment: equipTiers("warden"), companionEquipment: Object.fromEntries(loadout.map((id) => [id, equipTiers(id)])), formation: campaign.companionFormation });
    const { terminal, run: finalRun, ticksUsed, bossTtkTicks } = driveBattleToTerminal(run);
    const outcome = terminal === "DEFEAT" ? "defeat" : "victory";
    if (finalRun.extracted && finalRun.eliteCandidate) { const eliteCompanion = STAGE_BY_ID[stage.id]?.eliteCompanion; if (eliteCompanion) { try { campaign = captureElite(campaign, finalRun.eliteCandidate.eliteId, eliteCompanion); campaign = applyLoadoutPolicy(campaign, policy, rng); } catch (e) { console.error(`elite capture failed ${archetypeId}/${seed}/${stage.id}:`, e.message); } } }
    campaign = applyCampaignRunResult(campaign, { stageId: stage.id, outcome: terminal === "FINAL_COMPLETION" ? "FINAL_COMPLETION" : outcome });
    if (outcome === "victory" || terminal === "FINAL_COMPLETION") campaign = applyPolicyInvestments(campaign, policy, rng);
    stageResults.push({ stageId: stage.id, outcome, terminal, ticksUsed, bossTtkTicks, echoCoreEarned: echoCoreEarned(campaign), wardLevel: wardLevel(campaign), loadout: campaign.companionLoadout.prototypeIds, statPoints: { ...campaign.wardenProgress.statPoints }, traitIds: [...campaign.wardenProgress.traitIds] });
    if (outcome === "defeat") break;
  }
  return { archetypeId, seed, stageResults };
}

const args = process.argv.slice(2);
const targetArchetype = args[0];
const outputIndex = args.indexOf("--output");
const output = outputIndex === -1 ? null : args[outputIndex + 1];
const seeds = [301, 302, 303];
if (!targetArchetype || !ARCHETYPES[targetArchetype] || !output || output.startsWith("-")) {
  console.error("Usage: node run-g2-archetype-rotation.mjs <archetypeId> --output <path.json>. Valid archetypeId:", Object.keys(ARCHETYPES).join(", "));
  process.exit(1);
}
const t0 = Date.now();
const results = seeds.map((seed) => runArchetypeCampaign(targetArchetype, seed, 10));
const outputPath = resolve(output);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(results), "utf8");
console.log(`${targetArchetype}: done in ${Date.now() - t0}ms, wrote ${outputPath}`);
