/**
 * Solo Warden RPG layer catalog — permanent-progression data for Track A (Dusk
 * Warden stats/skills) and Track B (companion roles/equipment/formation) plus
 * the Warden trait pool. Companion base identity (id/name/damage/fireTicks/
 * range) and Warden baselines stay owned by `defense-catalog.js`; this module
 * only adds the RPG layer on top and never redefines run-scoped sim data.
 *
 * Design source: `_workspace/20260723-solo-warden-rpg-concept/design/
 * UNIFIED-GDD.md` §3, §9 and `design/balance-sheet.md`. All values carry a
 * TARGET label there — unvalidated until Stage 2 QA simulation.
 *
 * Contract (UNIFIED-GDD.md §3.4): derive functions take only catalog +
 * permanent-progress-state input, no numeric literals of their own — every
 * number a derive function emits traces to a field on one of the tables
 * below, so a rebalance never requires a code change.
 */
const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const clamp = (value, low, high) => value < low ? low : value > high ? high : value;

/** Track A: Dusk Warden permanent stat block. Currency: Echo Core, campaign budget 40. */
export const WARDEN_STAT_CURRENCY = "echo-core";
export const WARDEN_STAT_CAMPAIGN_BUDGET = 40;
export const WARDEN_STATS = freeze({
  "binding-might": { id: "binding-might", name: "결속력", description: "기본 공격력 상승", maxPoints: 10, effect: { field: "basicDamage", perPoint: 15 } },
  "abyssal-resonance": { id: "abyssal-resonance", name: "심연 공명", description: "액티브 스킬 피해 상승", maxPoints: 10, effect: { field: "skillDamageMultiplier", perPoint: 0.02 } },
  "echo-swiftness": { id: "echo-swiftness", name: "메아리 신속", description: "스킬 쿨다운 감소", maxPoints: 10, effect: { field: "cooldownReduction", perPoint: 0.005, cap: 0.05 } },
  "gate-resolve": { id: "gate-resolve", name: "관문 결의", description: "최대 내구 상승", maxPoints: 10, effect: { field: "maxIntegrity", perPoint: 20 } },
  "fracture-precision": { id: "fracture-precision", name: "균열 정밀", description: "치명타 확률 상승", maxPoints: 10, effect: { field: "critChanceBp", perPoint: 100 } },
  "reclaim-radius": { id: "reclaim-radius", name: "회수 반경", description: "자원 획득 반경 상승", maxPoints: 10, effect: { field: "pickupRange", perPoint: 150 } },
});
/** Cost of the n-th point (1-indexed) in any Warden stat: [2,2,3,3,4,4,5,5,6,6], sum 40. */
export function wardenStatPointCost(pointIndex) { return Math.ceil(pointIndex / 2) + 1; }
export function wardenStatTotalCost(points) {
  let total = 0;
  for (let n = 1; n <= points; n += 1) total += wardenStatPointCost(n);
  return total;
}

/** Track A skill tree — 5 nodes, two branches + shared capstone. Total cost 41 > budget 40 (intentional trade-off). */
export const WARDEN_SKILL_TREE = freeze({
  "echo-backlash": { id: "echo-backlash", branch: "attack-t1", prereq: freeze([]), cost: 5, description: "10% 확률로 추가타(기본 공격력의 50%)", effect: { extraHitChance: 0.10, extraHitDamageMultiplier: 0.5 } },
  "echo-cascade": { id: "echo-cascade", branch: "attack-t2", prereq: freeze(["echo-backlash"]), cost: 8, description: "추가타 확률 25%, 배율 70%로 상승(echo-backlash 대체)", effect: { extraHitChance: 0.25, extraHitDamageMultiplier: 0.7 } },
  "wardens-ward": { id: "wardens-ward", branch: "survival-t1", prereq: freeze([]), cost: 5, description: "내구 30% 이하 최초 도달 시 최대 내구 15% 실드(런당 1회)", effect: { thresholdIntegrityFraction: 0.30, shieldFraction: 0.15 } },
  "wardens-vigil": { id: "wardens-vigil", branch: "survival-t2", prereq: freeze(["wardens-ward"]), cost: 8, description: "내구 50% 이하일 때 초당 0.5% 재생", effect: { thresholdIntegrityFraction: 0.50, regenPerSecondFraction: 0.005 } },
  "echo-warden-awakening": { id: "echo-warden-awakening", branch: "capstone", prereq: freeze(["echo-cascade", "wardens-vigil"]), cost: 15, description: "공격력+10%, 최대내구+10%, 내구 15% 이하 최초 도달 시 전스킬 쿨다운 초기화(런당 1회)", effect: { damageMultiplier: 1.10, maxIntegrityMultiplier: 1.10, thresholdIntegrityFraction: 0.15 } },
});
export const WARDEN_SKILL_TREE_TOTAL_COST = Object.values(WARDEN_SKILL_TREE).reduce((sum, node) => sum + node.cost, 0);

/** Warden traits — 8-pool, 3-offered/pick-1 at stage-clear sequence numbers 2/4/6/8/10, campaign-permanent, no respec. */
export const WARDEN_TRAIT_UNLOCK_SEQUENCES = freeze([2, 4, 6, 8, 10]);
export const WARDEN_TRAITS = freeze({
  "first-strike": { id: "first-strike", name: "선제격", description: "런 첫 공격 피해 +100%(1회)", tradeoff: "후반 무영향", effect: { kind: "once-first-attack", damageMultiplier: 2.0 } },
  "desperate-echo": { id: "desperate-echo", name: "사투의 메아리", description: "내구 25% 이하일 때 피해 +30%", tradeoff: "gate-resolve 저투자와 상충", effect: { kind: "conditional-integrity-below", thresholdIntegrityFraction: 0.25, damageMultiplier: 1.30 } },
  "reckless-reclaim": { id: "reckless-reclaim", name: "무모한 회수", description: "획득 반경 +40%, 피격 피해 +10%", tradeoff: "속도 vs 생존", effect: { kind: "static", pickupRangeMultiplier: 1.40, incomingDamageMultiplier: 1.10 } },
  "gate-keeper": { id: "gate-keeper", name: "관문지기", description: "최대 내구 +15%, 공격력 -8%", tradeoff: "탱키 vs 순딜", effect: { kind: "static", maxIntegrityMultiplier: 1.15, damageMultiplier: 0.92 } },
  "chain-reaction": { id: "chain-reaction", name: "연쇄반응", description: "처치마다 피해 +3%(최대 5중첩)", tradeoff: "물량전 강함/단일강적 약함", effect: { kind: "stacking-kill", perKillDamageBonus: 0.03, maxStacks: 5 } },
  "elite-hunter": { id: "elite-hunter", name: "정예사냥꾼", description: "정예/보스 대상 +20%, 일반 대상 -10%", tradeoff: "보스러시 vs 웨이브클리어", effect: { kind: "target-conditional", eliteDamageMultiplier: 1.20, normalDamageMultiplier: 0.90 } },
  "companions-wardpact": { id: "companions-wardpact", name: "동료서약", description: "동료 피해 +12%, 동료 사거리 -10%", tradeoff: "근접특화 vs 카이팅", effect: { kind: "static-companion", companionDamageMultiplier: 1.12, companionRangeMultiplier: 0.90 } },
  "echo-overflow": { id: "echo-overflow", name: "메아리 과잉", description: "쿨다운 -15%, 스킬 피해 -10%", tradeoff: "스팸 vs 강타", effect: { kind: "static", cooldownReduction: 0.15, skillDamageMultiplier: 0.90 } },
});
/**
 * Deterministic 3-offer set for a trait-unlock sequence number; [] if not an unlock point.
 * `excludeIds` (already-owned traits) are filtered out first — with 8 traits total and 5
 * unlock sequences (pigeonhole: 15 offer-slots > 8 traits), the raw round-robin WILL repeat a
 * trait across sequences; excluding already-owned ones guarantees no duplicate offer ever
 * reaches the player. Always yields exactly 3 while count(owned) <= 4 (guaranteed at every real
 * unlock point: sequence index i has exactly i traits owned, 8-i >= 3 for i in 0..4).
 * `excludeIds` omitted/empty reproduces the original unfiltered rotation byte-for-byte.
 */
export function wardenTraitOffersForSequence(sequenceNumber, excludeIds = []) {
  const slot = WARDEN_TRAIT_UNLOCK_SEQUENCES.indexOf(sequenceNumber);
  if (slot === -1) return freeze([]);
  const ids = Object.keys(WARDEN_TRAITS);
  const excluded = new Set(excludeIds);
  const rotated = ids.map((_, k) => ids[(slot * 3 + k) % ids.length]).filter((id) => !excluded.has(id));
  return freeze(rotated.slice(0, 3));
}

/** Track B: companion role passives (no stat allocation — fixed role + equipment + traits only, per director decision UNIFIED-GDD.md §3.3). */
export const COMPANION_ROLES = freeze({
  vanguard: { id: "vanguard", name: "수호", members: freeze(["anchor-shard", "veil-vanguard"]), description: "자체 내구+30%, 배치 중 Commander 피격-5%", selfIntegrityMultiplier: 1.30, commanderIncomingDamageMultiplier: 0.95 },
  striker: { id: "striker", name: "타격", members: freeze(["ember-cohort", "rift-lens"]), description: "피해+20%, 보스/정예 대상 추가+10%", damageBonus: 0.20, eliteDamageBonus: 0.30 },
  support: { id: "support", name: "지원", members: freeze(["throne-echo", "dawnless-crown"]), description: "Commander 획득반경+10%, 스킬쿨다운-5%", commanderPickupRangeMultiplier: 1.10, commanderCooldownReduction: 0.05 },
});
const COMPANION_ROLE_BY_MEMBER = freeze(Object.fromEntries(
  Object.values(COMPANION_ROLES).flatMap((role) => role.members.map((companionId) => [companionId, role.id])),
));
export function roleForCompanion(companionId) { return COMPANION_ROLE_BY_MEMBER[companionId] || null; }

/** Formation (UNIFIED-GDD.md §4.2): max_slots is owned by campaign-state.js MAX_LOADOUT_SIZE (3, unchanged). */
export const MAX_FRONT_SLOTS = 2;
export const FORMATION_SLOTS = freeze(["FRONT", "BACK"]);
/** BACK companion damage bonus when >=1 FRONT companion is alive (fire-time stance multiplier, additive bp per UNIFIED-GDD.md §4.2). */
export const BACK_ROW_SYNERGY_DAMAGE_BONUS = 0.25;
/** Boss Rally Window: cooldown reduction applied to all living companions' fire cooldown when a boss spawns with >=1 FRONT filled. */
export const BOSS_RALLY_COOLDOWN_REDUCTION = 0.20;

/** Equipment: shared 5-tier ladder, 3 slots (weapon/ward/trinket), same structure for Warden and companions. */
export const EQUIPMENT_SLOTS = freeze(["weapon", "ward", "trinket"]);
/** `vertexCount` is the icon-channel encoding for UNIFIED-GDD.md §6.3's mandatory color-independent tier identification (0=circle/T1 .. 6=hexagon/T5). */
export const EQUIPMENT_TIERS = freeze([
  { id: "T1", name: "Echo-Bound", multiplier: 1.00, vertexCount: 0 },
  { id: "T2", name: "Umbral-Etched", multiplier: 1.15, vertexCount: 3 },
  { id: "T3", name: "Void-Forged", multiplier: 1.35, vertexCount: 4 },
  { id: "T4", name: "Abyss-Tempered", multiplier: 1.60, vertexCount: 5 },
  { id: "T5", name: "Court-Sealed", multiplier: 2.00, vertexCount: 6 },
]);
export const EQUIPMENT_CURRENCY = "bound-fragment";
export const EQUIPMENT_CAMPAIGN_BUDGET = 10;
/** Cost to advance one tier index -> next (0-based: 0=T1..4=T5). Matches [1,2,3,4], sum 10 (one slot to T5). */
export const EQUIPMENT_TIER_UPGRADE_COST = freeze([1, 2, 3, 4]);
export function equipmentTierUpgradeCost(tierIndex) {
  if (tierIndex < 0 || tierIndex >= EQUIPMENT_TIER_UPGRADE_COST.length) return null;
  return EQUIPMENT_TIER_UPGRADE_COST[tierIndex];
}
export function equipmentTierMultiplier(tierIndex) { return EQUIPMENT_TIERS[clamp(tierIndex, 0, EQUIPMENT_TIERS.length - 1)].multiplier; }

/**
 * Companion formationIntegrity (D7b, PRED-09 mitigation lever): FRONT companions are
 * consumable per-run via this pool. `damage` is the catalog base (defense-catalog.js
 * COMPANIONS[id].damage) — pass the raw base, not an equipment-adjusted value; the
 * ward-slot multiplier is the entire investment signal this formula measures.
 */
export function companionFormationIntegrity(baseDamage, wardTierIndex) {
  return baseDamage * 8 * equipmentTierMultiplier(wardTierIndex);
}

/**
 * Pure composition of a Warden's permanent-progress state into additive runtime
 * modifiers (step_1 of the shared computation chain, UNIFIED-GDD.md §9.1). Stats +
 * skill-tree flat bonuses + equipment + traits combine additively within this step;
 * the only multiplicative step is the fire-time formation-stance modifier applied by
 * the simulation (step_2, not here). Conditional/stateful trait and skill effects
 * (thresholds, once-flags, kill-stacks) are NOT resolved here — they need live run
 * state, so this returns descriptors for the simulation tick loop to evaluate.
 *
 * @param {{statPoints?: Record<string, number>, skillTreeIds?: string[], traitIds?: string[], equipment?: {weapon?: number, ward?: number, trinket?: number}}} wardenProgress
 */
export function deriveWardenRuntimeStats(wardenProgress = {}) {
  const statPoints = wardenProgress.statPoints || {};
  const skillTreeIds = wardenProgress.skillTreeIds || [];
  const traitIds = wardenProgress.traitIds || [];
  const equipment = wardenProgress.equipment || {};

  const modifiers = {
    basicDamageBonus: 0, maxIntegrityBonus: 0, critChanceBonusBp: 0, pickupRangeBonus: 0,
    cooldownReduction: 0, skillDamageMultiplier: 0, damageMultiplierDelta: 0, incomingDamageMultiplierDelta: 0,
    companionDamageMultiplier: 1, companionRangeMultiplier: 1, companionIncomingDamageMultiplier: 1,
  };

  Object.entries(statPoints).forEach(([statId, points]) => {
    const stat = WARDEN_STATS[statId];
    if (!stat || !Number.isInteger(points) || points <= 0) return;
    const clamped = clamp(points, 0, stat.maxPoints);
    const raw = stat.effect.perPoint * clamped;
    const applied = stat.effect.cap !== undefined ? Math.min(raw, stat.effect.cap) : raw;
    if (stat.effect.field === "basicDamage") modifiers.basicDamageBonus += applied;
    else if (stat.effect.field === "maxIntegrity") modifiers.maxIntegrityBonus += applied;
    else if (stat.effect.field === "critChanceBp") modifiers.critChanceBonusBp += applied;
    else if (stat.effect.field === "pickupRange") modifiers.pickupRangeBonus += applied;
    else if (stat.effect.field === "cooldownReduction") modifiers.cooldownReduction += applied;
    else if (stat.effect.field === "skillDamageMultiplier") modifiers.skillDamageMultiplier += applied;
  });

  if (skillTreeIds.includes("echo-warden-awakening")) {
    const node = WARDEN_SKILL_TREE["echo-warden-awakening"];
    modifiers.damageMultiplierDelta += node.effect.damageMultiplier - 1;
  }
  const maxIntegrityMultiplierDelta = skillTreeIds.includes("echo-warden-awakening")
    ? WARDEN_SKILL_TREE["echo-warden-awakening"].effect.maxIntegrityMultiplier - 1 : 0;

  traitIds.forEach((traitId) => {
    const trait = WARDEN_TRAITS[traitId];
    if (!trait) return;
    const eff = trait.effect;
    if (eff.kind === "static") {
      if (eff.damageMultiplier !== undefined) modifiers.damageMultiplierDelta += eff.damageMultiplier - 1;
      if (eff.cooldownReduction !== undefined) modifiers.cooldownReduction += eff.cooldownReduction;
      if (eff.skillDamageMultiplier !== undefined) modifiers.skillDamageMultiplier += eff.skillDamageMultiplier - 1;
    } else if (eff.kind === "static-companion") {
      modifiers.companionDamageMultiplier *= eff.companionDamageMultiplier;
      modifiers.companionRangeMultiplier *= eff.companionRangeMultiplier;
    }
  });
  const rawTraitIncoming = traitIds.includes("reckless-reclaim") ? WARDEN_TRAITS["reckless-reclaim"].effect.incomingDamageMultiplier - 1 : 0;
  modifiers.incomingDamageMultiplierDelta += rawTraitIncoming;
  const pickupRangeMultiplierDelta = traitIds.includes("reckless-reclaim") ? WARDEN_TRAITS["reckless-reclaim"].effect.pickupRangeMultiplier - 1 : 0;
  const gateKeeperIntegrityDelta = traitIds.includes("gate-keeper") ? WARDEN_TRAITS["gate-keeper"].effect.maxIntegrityMultiplier - 1 : 0;

  const weaponTier = clamp(equipment.weapon ?? 0, 0, EQUIPMENT_TIERS.length - 1);
  const wardTier = clamp(equipment.ward ?? 0, 0, EQUIPMENT_TIERS.length - 1);
  const trinketTier = clamp(equipment.trinket ?? 0, 0, EQUIPMENT_TIERS.length - 1);

  const extraHit = skillTreeIds.includes("echo-cascade") ? WARDEN_SKILL_TREE["echo-cascade"].effect
    : skillTreeIds.includes("echo-backlash") ? WARDEN_SKILL_TREE["echo-backlash"].effect : null;

  const firstStrikeMultiplier = traitIds.includes("first-strike") ? WARDEN_TRAITS["first-strike"].effect.damageMultiplier : null;
  const wardensWard = skillTreeIds.includes("wardens-ward") ? WARDEN_SKILL_TREE["wardens-ward"].effect : null;
  const wardensVigil = skillTreeIds.includes("wardens-vigil") ? WARDEN_SKILL_TREE["wardens-vigil"].effect : null;
  const awakeningReset = skillTreeIds.includes("echo-warden-awakening") ? { thresholdIntegrityFraction: WARDEN_SKILL_TREE["echo-warden-awakening"].effect.thresholdIntegrityFraction } : null;
  const desperateEcho = traitIds.includes("desperate-echo") ? WARDEN_TRAITS["desperate-echo"].effect : null;
  const chainReaction = traitIds.includes("chain-reaction") ? WARDEN_TRAITS["chain-reaction"].effect : null;
  const eliteHunter = traitIds.includes("elite-hunter") ? WARDEN_TRAITS["elite-hunter"].effect : null;

  return freeze({
    basicDamageBonus: Math.round(modifiers.basicDamageBonus),
    maxIntegrityBonus: Math.round(modifiers.maxIntegrityBonus),
    maxIntegrityMultiplier: 1 + maxIntegrityMultiplierDelta + gateKeeperIntegrityDelta,
    critChanceBonusBp: Math.round(modifiers.critChanceBonusBp),
    pickupRangeBonus: Math.round(modifiers.pickupRangeBonus),
    pickupRangeMultiplier: 1 + pickupRangeMultiplierDelta,
    cooldownReduction: modifiers.cooldownReduction,
    skillDamageMultiplier: 1 + modifiers.skillDamageMultiplier,
    damageMultiplier: 1 + modifiers.damageMultiplierDelta,
    incomingDamageMultiplier: 1 + modifiers.incomingDamageMultiplierDelta,
    companionDamageMultiplier: modifiers.companionDamageMultiplier,
    companionRangeMultiplier: modifiers.companionRangeMultiplier,
    weaponTierMultiplier: equipmentTierMultiplier(weaponTier),
    wardTierMultiplier: equipmentTierMultiplier(wardTier),
    trinketTierMultiplier: equipmentTierMultiplier(trinketTier),
    extraHit,
    firstStrikeMultiplier,
    wardensWard,
    wardensVigil,
    awakeningReset,
    desperateEcho,
    chainReaction,
    eliteHunter,
  });
}

/**
 * Pure composition of one companion's equipment + role into runtime modifiers.
 * `baseDamage`/`baseRange` are the defense-catalog.js COMPANIONS[id] values.
 */
export function deriveCompanionRuntimeStats(companionId, { equipment = {} } = {}) {
  const role = roleForCompanion(companionId);
  const roleData = role ? COMPANION_ROLES[role] : null;
  const weaponTier = clamp(equipment.weapon ?? 0, 0, EQUIPMENT_TIERS.length - 1);
  const trinketTier = clamp(equipment.trinket ?? 0, 0, EQUIPMENT_TIERS.length - 1);
  const wardTier = clamp(equipment.ward ?? 0, 0, EQUIPMENT_TIERS.length - 1);
  return freeze({
    role,
    weaponTierMultiplier: equipmentTierMultiplier(weaponTier),
    trinketTierMultiplier: equipmentTierMultiplier(trinketTier),
    wardTierIndex: wardTier,
    damageBonus: roleData?.damageBonus ?? 0,
    eliteDamageBonus: roleData?.eliteDamageBonus ?? 0,
    selfIntegrityMultiplier: roleData?.selfIntegrityMultiplier ?? 1,
    commanderIncomingDamageMultiplier: roleData?.commanderIncomingDamageMultiplier ?? 1,
    commanderPickupRangeMultiplier: roleData?.commanderPickupRangeMultiplier ?? 1,
    commanderCooldownReduction: roleData?.commanderCooldownReduction ?? 0,
  });
}

/**
 * Total permanent-power governance (D6, UNIFIED-GDD.md §9.1) — R1/R3/R5 share one
 * computation chain and must be reviewed as a set. TARGET ceilings, unvalidated
 * until Stage 2 QA simulation; the exact enforcement site (which effectiveDamage
 * snapshot to clamp) is explicitly deferred to Stage 2 in the source doc.
 */
export const POWER_GOVERNANCE = freeze({
  r1WardenCapacityCeilingPct: 20,
  r3ComboDominanceMultiplierCeiling: 1.3,
  r5SessionGrowthMultiplierCeiling: 1.6,
  r5CeilingReachedBySession: 15,
});
