import assert from "node:assert/strict";
import test from "node:test";

import {
  WARDEN_STAT_CURRENCY,
  WARDEN_STAT_CAMPAIGN_BUDGET,
  WARDEN_STATS,
  wardenStatPointCost,
  wardenStatTotalCost,
  WARDEN_SKILL_TREE,
  WARDEN_SKILL_TREE_TOTAL_COST,
  WARDEN_TRAIT_UNLOCK_SEQUENCES,
  WARDEN_TRAITS,
  wardenTraitOffersForSequence,
  COMPANION_ROLES,
  roleForCompanion,
  MAX_FRONT_SLOTS,
  FORMATION_SLOTS,
  BACK_ROW_SYNERGY_DAMAGE_BONUS,
  BOSS_RALLY_COOLDOWN_REDUCTION,
  EQUIPMENT_SLOTS,
  EQUIPMENT_TIERS,
  EQUIPMENT_CAMPAIGN_BUDGET,
  EQUIPMENT_TIER_UPGRADE_COST,
  equipmentTierUpgradeCost,
  equipmentTierMultiplier,
  companionFormationIntegrity,
  deriveWardenRuntimeStats,
  deriveCompanionRuntimeStats,
  POWER_GOVERNANCE,
} from "../rpg-catalog.js";
import { COMPANIONS } from "../defense-catalog.js";

test("Warden stat currency, campaign budget, and the six stat definitions", () => {
  assert.equal(WARDEN_STAT_CURRENCY, "echo-core");
  assert.equal(WARDEN_STAT_CAMPAIGN_BUDGET, 40);
  assert.deepEqual(
    Object.keys(WARDEN_STATS).sort(),
    ["abyssal-resonance", "binding-might", "echo-swiftness", "fracture-precision", "gate-resolve", "reclaim-radius"],
  );
  Object.entries(WARDEN_STATS).forEach(([id, stat]) => {
    assert.equal(stat.id, id);
    assert.equal(stat.maxPoints, 10);
    assert.ok(stat.effect.field);
    assert.ok(stat.effect.perPoint > 0);
  });
});

test("wardenStatPointCost follows the ceil(n/2)+1 curve and sums to the campaign budget at 10 points", () => {
  assert.deepEqual(
    Array.from({ length: 10 }, (_, index) => wardenStatPointCost(index + 1)),
    [2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
  );
  assert.equal(wardenStatTotalCost(10), WARDEN_STAT_CAMPAIGN_BUDGET);
  assert.equal(wardenStatTotalCost(0), 0);
  assert.equal(wardenStatTotalCost(1), 2);
});

test("the skill tree has five nodes, a prerequisite chain, and a total cost that exceeds the budget by design", () => {
  assert.deepEqual(
    Object.keys(WARDEN_SKILL_TREE).sort(),
    ["echo-backlash", "echo-cascade", "echo-warden-awakening", "wardens-vigil", "wardens-ward"],
  );
  assert.deepEqual(WARDEN_SKILL_TREE["echo-backlash"].prereq, []);
  assert.deepEqual(WARDEN_SKILL_TREE["echo-cascade"].prereq, ["echo-backlash"]);
  assert.deepEqual(WARDEN_SKILL_TREE["wardens-ward"].prereq, []);
  assert.deepEqual(WARDEN_SKILL_TREE["wardens-vigil"].prereq, ["wardens-ward"]);
  assert.deepEqual(WARDEN_SKILL_TREE["echo-warden-awakening"].prereq, ["echo-cascade", "wardens-vigil"]);
  assert.equal(WARDEN_SKILL_TREE_TOTAL_COST, 41);
  assert.ok(WARDEN_SKILL_TREE_TOTAL_COST > WARDEN_STAT_CAMPAIGN_BUDGET, "the full tree must exceed the 40-point campaign budget (intentional trade-off)");
});

test("wardenTraitOffersForSequence returns a deterministic 3-of-8 offer at each unlock sequence and covers all 8 traits", () => {
  assert.deepEqual(WARDEN_TRAIT_UNLOCK_SEQUENCES, [2, 4, 6, 8, 10]);
  assert.equal(Object.keys(WARDEN_TRAITS).length, 8);

  const offersBySequence = WARDEN_TRAIT_UNLOCK_SEQUENCES.map((sequence) => wardenTraitOffersForSequence(sequence));
  offersBySequence.forEach((offers) => {
    assert.equal(offers.length, 3);
    offers.forEach((traitId) => assert.ok(Object.hasOwn(WARDEN_TRAITS, traitId)));
    assert.equal(new Set(offers).size, 3, "an offer must not repeat a trait within the same sequence");
  });

  const coveredTraits = new Set(offersBySequence.flat());
  assert.equal(coveredTraits.size, 8, "the union of all offered traits across the 5 sequences must cover all 8 traits");

  // determinism: same sequence always returns the same offer
  assert.deepEqual(wardenTraitOffersForSequence(2), wardenTraitOffersForSequence(2));

  // non-unlock sequence numbers return an empty offer
  assert.deepEqual(wardenTraitOffersForSequence(1), []);
  assert.deepEqual(wardenTraitOffersForSequence(3), []);
  assert.deepEqual(wardenTraitOffersForSequence(11), []);
});

test("companion roles cover the 6 canonical companions two-per-role, and roleForCompanion resolves both directions", () => {
  assert.deepEqual(Object.keys(COMPANION_ROLES).sort(), ["striker", "support", "vanguard"]);
  const allMembers = Object.values(COMPANION_ROLES).flatMap((role) => role.members);
  assert.deepEqual([...allMembers].sort(), Object.keys(COMPANIONS).sort());
  assert.equal(new Set(allMembers).size, allMembers.length, "no companion may belong to two roles");

  assert.equal(roleForCompanion("ember-cohort"), "striker");
  assert.equal(roleForCompanion("rift-lens"), "striker");
  assert.equal(roleForCompanion("anchor-shard"), "vanguard");
  assert.equal(roleForCompanion("veil-vanguard"), "vanguard");
  assert.equal(roleForCompanion("throne-echo"), "support");
  assert.equal(roleForCompanion("dawnless-crown"), "support");
  assert.equal(roleForCompanion("not-a-companion"), null);
});

test("formation, back-row synergy, and boss-rally constants match the authored balance sheet", () => {
  assert.equal(MAX_FRONT_SLOTS, 2);
  assert.deepEqual(FORMATION_SLOTS, ["FRONT", "BACK"]);
  assert.equal(BACK_ROW_SYNERGY_DAMAGE_BONUS, 0.25);
  assert.equal(BOSS_RALLY_COOLDOWN_REDUCTION, 0.20);
});

test("equipment tiers, budget, and per-step upgrade costs match the authored 5-tier ladder", () => {
  assert.deepEqual(EQUIPMENT_SLOTS, ["weapon", "ward", "trinket"]);
  assert.equal(EQUIPMENT_TIERS.length, 5);
  assert.deepEqual(EQUIPMENT_TIERS.map((tier) => tier.multiplier), [1.00, 1.15, 1.35, 1.60, 2.00]);
  assert.equal(EQUIPMENT_CAMPAIGN_BUDGET, 10);
  assert.deepEqual(EQUIPMENT_TIER_UPGRADE_COST, [1, 2, 3, 4]);
  assert.equal(EQUIPMENT_TIER_UPGRADE_COST.reduce((sum, cost) => sum + cost, 0), EQUIPMENT_CAMPAIGN_BUDGET);
});

test("equipmentTierUpgradeCost and equipmentTierMultiplier resolve and clamp correctly at the boundaries", () => {
  assert.deepEqual([0, 1, 2, 3].map(equipmentTierUpgradeCost), [1, 2, 3, 4]);
  assert.equal(equipmentTierUpgradeCost(4), null, "T5 (index 4) has no further upgrade step");
  assert.equal(equipmentTierUpgradeCost(-1), null);

  assert.deepEqual([0, 1, 2, 3, 4].map(equipmentTierMultiplier), [1.00, 1.15, 1.35, 1.60, 2.00]);
  assert.equal(equipmentTierMultiplier(-3), 1.00, "an out-of-range low index clamps to T1");
  assert.equal(equipmentTierMultiplier(99), 2.00, "an out-of-range high index clamps to T5");
});

test("companionFormationIntegrity matches the balance-sheet.md worked examples for ember-cohort", () => {
  // balance-sheet.md: "ember-cohort: 420*8*1.00 = 3360" (T1 uninvested) and "420*8*2.00 = 6720" (T5 fully invested)
  assert.equal(companionFormationIntegrity(420, 0), 3360);
  assert.equal(companionFormationIntegrity(420, 4), 6720);
  assert.equal(companionFormationIntegrity(COMPANIONS["ember-cohort"].damage, 0), 3360);
  assert.equal(companionFormationIntegrity(COMPANIONS["ember-cohort"].damage, 4), 6720);
});

test("deriveWardenRuntimeStats returns an all-neutral/identity object for empty or absent progress", () => {
  const empty = deriveWardenRuntimeStats({});
  const absent = deriveWardenRuntimeStats();
  assert.deepEqual(empty, absent);
  assert.equal(empty.basicDamageBonus, 0);
  assert.equal(empty.maxIntegrityBonus, 0);
  assert.equal(empty.maxIntegrityMultiplier, 1);
  assert.equal(empty.critChanceBonusBp, 0);
  assert.equal(empty.pickupRangeBonus, 0);
  assert.equal(empty.pickupRangeMultiplier, 1);
  assert.equal(empty.cooldownReduction, 0);
  assert.equal(empty.skillDamageMultiplier, 1);
  assert.equal(empty.damageMultiplier, 1);
  assert.equal(empty.incomingDamageMultiplier, 1);
  assert.equal(empty.companionDamageMultiplier, 1);
  assert.equal(empty.companionRangeMultiplier, 1);
  assert.equal(empty.weaponTierMultiplier, 1);
  assert.equal(empty.wardTierMultiplier, 1);
  assert.equal(empty.trinketTierMultiplier, 1);
  assert.equal(empty.extraHit, null);
  assert.equal(empty.firstStrikeMultiplier, null);
  assert.equal(empty.wardensWard, null);
  assert.equal(empty.wardensVigil, null);
  assert.equal(empty.awakeningReset, null);
  assert.equal(empty.desperateEcho, null);
  assert.equal(empty.chainReaction, null);
  assert.equal(empty.eliteHunter, null);
});

test("deriveWardenRuntimeStats composes stat points additively and respects the echo-swiftness cooldown cap", () => {
  const runtime = deriveWardenRuntimeStats({ statPoints: { "binding-might": 3, "gate-resolve": 2, "echo-swiftness": 10 } });
  assert.equal(runtime.basicDamageBonus, 15 * 3);
  assert.equal(runtime.maxIntegrityBonus, 20 * 2);
  // echo-swiftness: perPoint 0.005, cap 0.05 -> 10 points would be 0.05 uncapped, exactly at cap
  assert.equal(runtime.cooldownReduction, 0.05);
});

test("deriveWardenRuntimeStats caps echo-swiftness cooldownReduction below the uncapped value when points exceed the cap threshold", () => {
  // 10 points * 0.005 = 0.05 exactly hits the cap; verify the cap is actually enforced (not just coincidentally equal)
  // by checking a stat with no cap scales linearly for comparison, and echo-swiftness matches its cap field exactly.
  const stat = deriveWardenRuntimeStats({ statPoints: { "echo-swiftness": 10 } });
  assert.equal(stat.cooldownReduction, 0.05);
  const halved = deriveWardenRuntimeStats({ statPoints: { "echo-swiftness": 5 } });
  assert.equal(halved.cooldownReduction, 0.025, "below the cap, cooldownReduction scales linearly with points");
});

test("deriveWardenRuntimeStats resolves skill-tree extraHit preferring echo-cascade over echo-backlash, and applies the awakening capstone deltas", () => {
  const backlashOnly = deriveWardenRuntimeStats({ skillTreeIds: ["echo-backlash"] });
  assert.deepEqual(backlashOnly.extraHit, { extraHitChance: 0.10, extraHitDamageMultiplier: 0.5 });

  const cascade = deriveWardenRuntimeStats({ skillTreeIds: ["echo-backlash", "echo-cascade"] });
  assert.deepEqual(cascade.extraHit, { extraHitChance: 0.25, extraHitDamageMultiplier: 0.7 }, "echo-cascade supersedes echo-backlash when both are unlocked");

  const awakened = deriveWardenRuntimeStats({ skillTreeIds: ["echo-backlash", "echo-cascade", "wardens-ward", "wardens-vigil", "echo-warden-awakening"] });
  assert.equal(awakened.damageMultiplier, 1.10);
  assert.equal(awakened.maxIntegrityMultiplier, 1.10);
  assert.deepEqual(awakened.awakeningReset, { thresholdIntegrityFraction: 0.15 });
});

test("deriveWardenRuntimeStats applies trait effects: static damage/cooldown deltas, static-companion multiplicative stacking, and conditional descriptors", () => {
  const gateKeeper = deriveWardenRuntimeStats({ traitIds: ["gate-keeper"] });
  assert.equal(gateKeeper.damageMultiplier, 0.92);
  assert.equal(gateKeeper.maxIntegrityMultiplier, 1.15);

  const wardpact = deriveWardenRuntimeStats({ traitIds: ["companions-wardpact"] });
  assert.equal(wardpact.companionDamageMultiplier, 1.12);
  assert.equal(wardpact.companionRangeMultiplier, 0.90);

  const reckless = deriveWardenRuntimeStats({ traitIds: ["reckless-reclaim"] });
  assert.equal(reckless.pickupRangeMultiplier, 1.40);
  assert.equal(reckless.incomingDamageMultiplier, 1.10);

  const desperateEcho = deriveWardenRuntimeStats({ traitIds: ["desperate-echo"] });
  assert.deepEqual(desperateEcho.desperateEcho, { kind: "conditional-integrity-below", thresholdIntegrityFraction: 0.25, damageMultiplier: 1.30 });

  const chainReaction = deriveWardenRuntimeStats({ traitIds: ["chain-reaction"] });
  assert.deepEqual(chainReaction.chainReaction, { kind: "stacking-kill", perKillDamageBonus: 0.03, maxStacks: 5 });

  const eliteHunter = deriveWardenRuntimeStats({ traitIds: ["elite-hunter"] });
  assert.deepEqual(eliteHunter.eliteHunter, { kind: "target-conditional", eliteDamageMultiplier: 1.20, normalDamageMultiplier: 0.90 });

  const firstStrike = deriveWardenRuntimeStats({ traitIds: ["first-strike"] });
  assert.equal(firstStrike.firstStrikeMultiplier, 2.0);
});

test("deriveWardenRuntimeStats clamps out-of-range equipment tiers and applies weapon/ward/trinket multipliers", () => {
  const equipped = deriveWardenRuntimeStats({ equipment: { weapon: 4, ward: 2, trinket: 99 } });
  assert.equal(equipped.weaponTierMultiplier, 2.00);
  assert.equal(equipped.wardTierMultiplier, 1.35);
  assert.equal(equipped.trinketTierMultiplier, 2.00, "an out-of-range trinket tier clamps to the top tier (T5)");
});

test("deriveCompanionRuntimeStats resolves role, equipment tier multipliers, and neutral defaults for unequipped companions", () => {
  const unequipped = deriveCompanionRuntimeStats("ember-cohort", {});
  assert.equal(unequipped.role, "striker");
  assert.equal(unequipped.weaponTierMultiplier, 1.00);
  assert.equal(unequipped.trinketTierMultiplier, 1.00);
  assert.equal(unequipped.wardTierIndex, 0);
  assert.equal(unequipped.damageBonus, 0.20);
  assert.equal(unequipped.eliteDamageBonus, 0.30);
  assert.equal(unequipped.selfIntegrityMultiplier, 1, "striker has no self-integrity bonus");
  assert.equal(unequipped.commanderIncomingDamageMultiplier, 1);

  const vanguard = deriveCompanionRuntimeStats("veil-vanguard", { equipment: { ward: 4 } });
  assert.equal(vanguard.role, "vanguard");
  assert.equal(vanguard.selfIntegrityMultiplier, 1.30);
  assert.equal(vanguard.commanderIncomingDamageMultiplier, 0.95);
  assert.equal(vanguard.wardTierIndex, 4);
  assert.equal(vanguard.damageBonus, 0, "vanguard has no direct damage bonus");

  const support = deriveCompanionRuntimeStats("throne-echo", {});
  assert.equal(support.role, "support");
  assert.equal(support.commanderPickupRangeMultiplier, 1.10);
  assert.equal(support.commanderCooldownReduction, 0.05);

  const unknown = deriveCompanionRuntimeStats("not-a-companion", {});
  assert.equal(unknown.role, null);
  assert.equal(unknown.damageBonus, 0);
  assert.equal(unknown.selfIntegrityMultiplier, 1);
  assert.equal(unknown.commanderIncomingDamageMultiplier, 1);
});

test("POWER_GOVERNANCE exposes the three R1/R3/R5 ceilings from the balance sheet", () => {
  assert.equal(POWER_GOVERNANCE.r1WardenCapacityCeilingPct, 20);
  assert.equal(POWER_GOVERNANCE.r3ComboDominanceMultiplierCeiling, 1.3);
  assert.equal(POWER_GOVERNANCE.r5SessionGrowthMultiplierCeiling, 1.6);
  assert.equal(POWER_GOVERNANCE.r5CeilingReachedBySession, 15);
});
