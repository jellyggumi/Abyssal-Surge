import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDefenseRun,
  createDefenseRun,
  getRunDigest,
  getRunSnapshot,
  isTerminalRun,
  queueInput,
} from "../defense-run-simulation.js";
import { COMPANIONS } from "../defense-catalog.js";
import { BACK_ROW_SYNERGY_DAMAGE_BONUS, MAX_FRONT_SLOTS } from "../rpg-catalog.js";

/** Matches this repo's queueObjectiveCommands convention (see defense-run-simulation.test.mjs). */
function queueObjectiveCommands(run) {
  const snapshot = getRunSnapshot(run);
  if (snapshot.growthOffer) {
    return queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
  }
  let next = queueInput(run, "MOVE", { octant: "IDLE" });
  for (const skillId of snapshot.commander.skills) {
    next = queueInput(next, "SKILL_CAST", { skillId });
  }
  if (snapshot.eliteCandidate && !snapshot.extracted) {
    next = queueInput(next, "EXTRACT_ELITE", { enemyId: snapshot.eliteCandidate.enemyId });
  }
  return next;
}

/** Drives one raw tick at a time (not advanceDefenseRun's multi-step form) so `run.events`
 *  — which resets every tick — can be inspected on every single tick, not just the last of a jump. */
function stepAndCollect(run, steps, onEvent) {
  let next = run;
  for (let i = 0; i < steps && !isTerminalRun(next); i += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
    for (const event of next.events) onEvent(next, event);
  }
  return next;
}

function advanceThroughObjectivesUntil(run, predicate, maxSteps = 12000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceDefenseRun(queueObjectiveCommands(next), 1);
    if (predicate(next)) return next;
  }
  return next;
}

test("SNAPSHOT_VERSION is 6, and omitting all four new createDefenseRun params reproduces byte-identical legacy behavior", () => {
  const legacy = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const explicitDefaults = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    wardenProgress: null, wardenEquipment: {}, companionEquipment: {}, formation: {},
  });
  assert.equal(getRunSnapshot(legacy).version, 6);
  assert.equal(getRunDigest(legacy), getRunDigest(explicitDefaults));
  assert.equal(getRunSnapshot(legacy).wardenState, null);
  assert.equal(legacy.rpgActive, false);
});

test("a legacy companionLoadout array with no formation input defaults every companion to BACK", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"] });
  const slots = getRunSnapshot(run).companions.map((c) => c.slot);
  assert.deepEqual(slots, ["BACK", "BACK", "BACK"]);
});

test("requesting more than MAX_FRONT_SLOTS FRONT companions is clamped to 2, even when the caller asks for 3", () => {
  const run = createDefenseRun({
    stageId: "cinder-span", seed: 5,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    formation: { "ember-cohort": "FRONT", "rift-lens": "FRONT", "veil-vanguard": "FRONT" },
  });
  const bySlot = Object.fromEntries(getRunSnapshot(run).companions.map((c) => [c.companionId, c.slot]));
  const frontCount = Object.values(bySlot).filter((slot) => slot === "FRONT").length;
  assert.equal(frontCount, MAX_FRONT_SLOTS);
  assert.equal(bySlot["veil-vanguard"], "BACK", "the 3rd requested FRONT companion must be clamped to BACK");
});

test("getRunSnapshot companions carry slot, status, and an hp/maxHp pool equal to companionFormationIntegrity (not literal 1/1)", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const companion = getRunSnapshot(run).companions[0];
  assert.equal(companion.slot, "BACK");
  assert.equal(companion.status, "ACTIVE");
  // balance-sheet.md worked example: ember-cohort T1 uninvested = 420*8*1.00 = 3360
  assert.equal(companion.hp, 3360);
  assert.equal(companion.maxHp, 3360);
});

test("rpgActive stays false and companion damage matches the raw catalog value with no Warden investment and no equipment", () => {
  const run = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  assert.equal(run.rpgActive, false);
  assert.equal(getRunSnapshot(run).companions[0].damage, COMPANIONS["ember-cohort"].damage);
});

test("an empty-but-non-null wardenProgress object (no stat points, no skills, no traits) does not activate rpgActive", () => {
  const run = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    wardenProgress: { statPoints: {}, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(run.rpgActive, false);
  assert.equal(getRunSnapshot(run).companions[0].damage, COMPANIONS["ember-cohort"].damage);
});

test("rpgActive gating: real Warden stat investment flips rpgActive true and applies the striker role damage bonus (same seed and companion, only wardenProgress toggled)", () => {
  const inert = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"] });
  const active = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    wardenProgress: { statPoints: { "binding-might": 1 }, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(inert.rpgActive, false);
  assert.equal(active.rpgActive, true);
  assert.equal(getRunSnapshot(inert).companions[0].damage, 420);
  // ember-cohort is a striker: +20% damageBonus, applied only when rpgActive
  assert.equal(getRunSnapshot(active).companions[0].damage, Math.round(420 * 1.2));
});

test("rpgActive gating: equipment investment alone (no wardenProgress) also flips rpgActive true and stacks the equipment tier multiplier onto the role bonus", () => {
  const run = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["ember-cohort"],
    companionEquipment: { "ember-cohort": { weapon: 1 } }, // T2 = 1.15
  });
  assert.equal(run.rpgActive, true);
  assert.equal(getRunSnapshot(run).companions[0].damage, Math.round(420 * 1.2 * 1.15));
});

test("rpgActive gating: the vanguard role's selfIntegrityMultiplier (+30% maxHp) only applies once rpgActive is true", () => {
  const inert = createDefenseRun({ stageId: "cinder-span", seed: 5, companionLoadout: ["veil-vanguard"] });
  const active = createDefenseRun({
    stageId: "cinder-span", seed: 5, companionLoadout: ["veil-vanguard"],
    wardenProgress: { statPoints: { "binding-might": 1 }, skillTreeIds: [], traitIds: [] },
  });
  assert.equal(getRunSnapshot(inert).companions[0].maxHp, 2880); // 360*8*1.00
  assert.equal(getRunSnapshot(active).companions[0].maxHp, Math.round(2880 * 1.30));
});

test("critical mechanic: a FRONT companion takes contact/ranged damage from a driven run while a BACK companion in the same run never does", () => {
  let run = createDefenseRun({
    stageId: "gate-zenith", seed: 3,
    companionLoadout: ["veil-vanguard", "anchor-shard"],
    formation: { "veil-vanguard": "FRONT" }, // anchor-shard defaults BACK
  });
  let frontDamageEvents = 0;
  let backDamageEvents = 0;
  run = stepAndCollect(run, 2500, (_run, event) => {
    if (event.type !== "COMPANION_DAMAGED") return;
    if (event.companionId === "veil-vanguard") frontDamageEvents += 1;
    if (event.companionId === "anchor-shard") backDamageEvents += 1;
  });
  assert.ok(frontDamageEvents > 0, "the FRONT companion must take at least one contact/ranged hit over a driven run");
  assert.equal(backDamageEvents, 0, "a BACK companion must never take contact/ranged damage");
});

test("critical mechanic: a FRONT companion's sustained combat drives status ACTIVE -> DOWNED exactly once, and it stops firing and taking further damage afterward", () => {
  let run = createDefenseRun({
    stageId: "gate-zenith", seed: 3,
    companionLoadout: ["veil-vanguard"],
    formation: { "veil-vanguard": "FRONT" },
  });
  let downedTick = null;
  let downedEventCount = 0;
  let firedAfterDowned = 0;
  let damagedAfterDowned = 0;
  run = stepAndCollect(run, 2400, (current, event) => {
    if (event.type === "COMPANION_DOWNED") {
      downedTick = downedTick ?? current.tick;
      downedEventCount += 1;
    }
    if (downedTick !== null && event.type === "WEAPON_FIRED" && event.owner === "veil-vanguard") firedAfterDowned += 1;
    if (downedTick !== null && event.type === "COMPANION_DAMAGED" && event.companionId === "veil-vanguard") damagedAfterDowned += 1;
  });
  assert.equal(downedTick, 1820, "seed 3 on gate-zenith with a solo FRONT veil-vanguard downs deterministically at tick 1820");
  assert.equal(downedEventCount, 1, "the ACTIVE -> DOWNED transition fires exactly once");
  assert.equal(firedAfterDowned, 0, "a DOWNED companion must never fire WEAPON_FIRED again");
  assert.equal(damagedAfterDowned, 0, "a DOWNED companion must never take further COMPANION_DAMAGED hits");
  const finalCompanion = run.companions.find((c) => c.companionId === "veil-vanguard");
  assert.equal(finalCompanion.status, "DOWNED");
  assert.equal(finalCompanion.hp, 0);
});

test("critical mechanic: BACK_ROW_SYNERGY_DAMAGE_BONUS multiplies a BACK companion's WEAPON_FIRED damage only while >=1 FRONT companion is alive", () => {
  let run = createDefenseRun({
    stageId: "gate-zenith", seed: 3,
    companionLoadout: ["veil-vanguard", "ember-cohort"],
    formation: { "veil-vanguard": "FRONT" }, // ember-cohort defaults BACK
  });
  const backFireDamages = [];
  run = stepAndCollect(run, 2400, (_current, event) => {
    if (event.type === "WEAPON_FIRED" && event.owner === "ember-cohort") backFireDamages.push(event.damage);
  });
  assert.ok(backFireDamages.length > 0, "ember-cohort must fire at least once while veil-vanguard (FRONT) is alive");
  const expectedSynergyDamage = Math.round(COMPANIONS["ember-cohort"].damage * (1 + BACK_ROW_SYNERGY_DAMAGE_BONUS));
  assert.ok(backFireDamages.every((damage) => damage === expectedSynergyDamage), `every BACK fire while FRONT is alive must equal the synergy-boosted ${expectedSynergyDamage}, got ${JSON.stringify([...new Set(backFireDamages)])}`);
});

test("critical mechanic: once every FRONT companion is DOWNED, a BACK companion's fires drop back to unmultiplied raw damage (status filter, not just slot)", () => {
  // veil-vanguard solo FRONT downs deterministically at tick 1820 on this seed (see the DOWNED test above).
  // dawnless-crown auto-joins as BACK via elite extraction well after that (~tick 4102), while veil-vanguard's
  // *slot* is still "FRONT" (just DOWNED) — this specifically exercises livingFrontCompanions() filtering by
  // status==="ACTIVE" rather than merely slot==="FRONT".
  let run = createDefenseRun({
    stageId: "gate-zenith", seed: 3,
    companionLoadout: ["veil-vanguard"],
    formation: { "veil-vanguard": "FRONT" },
  });
  let downedTick = null;
  const joinedBackFireDamages = [];
  run = stepAndCollect(run, 4700, (current, event) => {
    if (event.type === "COMPANION_DOWNED" && downedTick === null) downedTick = current.tick;
    if (event.type === "WEAPON_FIRED" && event.owner === "dawnless-crown") joinedBackFireDamages.push(event.damage);
  });
  assert.equal(downedTick, 1820);
  const dawnlessCrown = run.companions.find((c) => c.companionId === "dawnless-crown");
  assert.ok(dawnlessCrown, "dawnless-crown must have auto-joined via elite extraction");
  assert.equal(dawnlessCrown.slot, "BACK");
  assert.ok(joinedBackFireDamages.length > 0, "dawnless-crown must fire at least once after joining");
  assert.ok(
    joinedBackFireDamages.every((damage) => damage === COMPANIONS["dawnless-crown"].damage),
    `every fire from a BACK companion joining after all FRONT companions are DOWNED must be raw unmultiplied damage (${COMPANIONS["dawnless-crown"].damage}), got ${JSON.stringify([...new Set(joinedBackFireDamages)])}`,
  );
});

test("critical mechanic: BOSS_RALLY_WINDOW fires with cooldownReductionBp=2000 only when >=1 living FRONT companion exists at boss spawn", () => {
  const withFront = createDefenseRun({
    stageId: "cinder-span", seed: 12,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    formation: { "ember-cohort": "FRONT" },
  });
  const toBossWithFront = advanceThroughObjectivesUntil(withFront, (run) => run.bossSpawned, 3000);
  const rallyEvent = toBossWithFront.events.find((event) => event.type === "BOSS_RALLY_WINDOW");
  assert.ok(rallyEvent, "a filled FRONT slot at boss spawn must emit BOSS_RALLY_WINDOW");
  assert.equal(rallyEvent.cooldownReductionBp, 2000);
  assert.equal(toBossWithFront.rallyTargetId, rallyEvent.entityId);

  const withoutFront = createDefenseRun({
    stageId: "cinder-span", seed: 12,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"], // legacy, no formation -> all BACK
  });
  const toBossWithoutFront = advanceThroughObjectivesUntil(withoutFront, (run) => run.bossSpawned, 3000);
  const noRally = toBossWithoutFront.events.find((event) => event.type === "BOSS_RALLY_WINDOW");
  assert.equal(noRally, undefined, "0 FRONT companions at boss spawn must never emit BOSS_RALLY_WINDOW (backward-compat with pre-RPG behavior)");
  assert.equal(toBossWithoutFront.rallyTargetId, null);
});

test("critical mechanic: getRunDigest is byte-identical for two createDefenseRun calls with identical seed and full RPG params, through creation, mid-run, and terminal", () => {
  const params = {
    stageId: "cinder-span", seed: 21,
    companionLoadout: ["ember-cohort", "veil-vanguard"],
    wardenProgress: { statPoints: { "binding-might": 2, "gate-resolve": 1 }, skillTreeIds: ["echo-backlash"], traitIds: [] },
    wardenEquipment: { weapon: 1, ward: 0, trinket: 0 },
    companionEquipment: { "ember-cohort": { weapon: 1 } },
    formation: { "ember-cohort": "FRONT" },
  };
  const left0 = createDefenseRun(params);
  const right0 = createDefenseRun(params);
  assert.equal(getRunDigest(left0), getRunDigest(right0), "digests must match immediately at creation");

  let left = advanceThroughObjectivesUntil(left0, (run) => run.tick >= 400, 400);
  let right = advanceThroughObjectivesUntil(right0, (run) => run.tick >= 400, 400);
  assert.equal(getRunDigest(left), getRunDigest(right), "digests must match after identical driven ticks mid-run");

  left = advanceThroughObjectivesUntil(left, (run) => isTerminalRun(run), 6000);
  right = advanceThroughObjectivesUntil(right, (run) => isTerminalRun(run), 6000);
  assert.ok(isTerminalRun(left) && isTerminalRun(right));
  assert.equal(left.terminal, right.terminal);
  assert.equal(getRunDigest(left), getRunDigest(right), "digests must match at the terminal state");
});
