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
import { CUTSCENES, XP_GROWTH } from "../defense-catalog.js";

function advanceWithOffers(run, steps, onTick = () => {}) {
  let next = run;
  for (let tick = 0; tick < steps && !isTerminalRun(next); tick += 1) {
    const snapshot = getRunSnapshot(next);
    if (snapshot.growthOffer) next = queueInput(next, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    onTick(snapshot, (type, payload) => { next = queueInput(next, type, payload); });
    next = advanceDefenseRun(next, 1);
  }
  return next;
}

function advanceUntilSnapshot(run, predicate, maxSteps = 10000) {
  let next = run;
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceWithOffers(next, 1);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return snapshot;
  }
  return getRunSnapshot(next);
}

function advanceUntilWithPrevious(run, predicate, maxSteps = 10000) {
  let next = run;
  let previous = getRunSnapshot(run);
  for (let step = 0; step < maxSteps && !isTerminalRun(next); step += 1) {
    next = advanceWithOffers(next, 1);
    const snapshot = getRunSnapshot(next);
    if (predicate(snapshot)) return { previous, snapshot };
    previous = snapshot;
  }
  return { previous, snapshot: getRunSnapshot(next) };
}

test("equal seeds and identical inputs produce identical deterministic digests", () => {
  let left = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  let right = createDefenseRun({ stageId: "cinder-span", seed: 71, companionLoadout: ["ember-cohort"] });
  for (const input of [["MOVE", { octant: "NW" }], ["MOVE", { octant: "SE" }]]) {
    left = queueInput(left, input[0], input[1]);
    right = queueInput(right, input[0], input[1]);
  }
  left = advanceWithOffers(left, 500);
  right = advanceWithOffers(right, 500);
  assert.equal(getRunDigest(left), getRunDigest(right));
});

test("the commander remains at the explicit idle position until movement input", () => {
  const initial = createDefenseRun({ stageId: "cinder-span", seed: 1 });
  const idle = advanceDefenseRun(initial, 1);
  const moved = advanceDefenseRun(queueInput(initial, "MOVE", { octant: "N" }), 1);
  assert.equal(getRunSnapshot(initial).commander.move, "IDLE");
  assert.deepEqual(getRunSnapshot(idle).commander.x, getRunSnapshot(initial).commander.x);
  assert.equal(getRunSnapshot(moved).commander.y, 5932);
});

test("growth pauses simulation until one offered skill is selected", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 4, companionLoadout: ["ember-cohort", "rift-lens"] });
  run = advanceDefenseRun(run, 600);
  const offer = getRunSnapshot(run).growthOffer;
  assert.ok(offer, "earned XP should present a growth offer");
  const pausedTick = getRunSnapshot(run).tick;
  assert.equal(getRunSnapshot(advanceDefenseRun(run, 120)).tick, pausedTick);
  const selected = advanceDefenseRun(queueInput(run, "SKILL_SELECTED", { skillId: offer.choices[0] }), 1);
  const repeated = advanceDefenseRun(queueInput(selected, "SKILL_SELECTED", { skillId: offer.choices[0] }), 1);
  assert.equal(getRunSnapshot(selected).growthOffer, null);
  assert.equal(getRunSnapshot(repeated).commander.level, offer.level);
});

test("an elite can be extracted only after defeat and only once", () => {
  let run = createDefenseRun({ stageId: "cinder-span", seed: 9 });
  run = advanceWithOffers(run, 360);
  const livingElite = getRunSnapshot(run).enemies.find((entry) => entry.elite);
  assert.ok(livingElite, "stage exposes one eligible elite");
  const beforeDefeat = advanceDefenseRun(queueInput(run, "EXTRACT_ELITE", { enemyId: livingElite.id }), 1);
  assert.equal(getRunSnapshot(beforeDefeat).extracted, false);
  run = advanceWithOffers(run, 500);
  const candidate = getRunSnapshot(run).eliteCandidate;
  assert.ok(candidate, "the defeated elite remains extractable for a bounded window");
  run = advanceDefenseRun(queueInput(run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }), 1);
  const extracted = getRunSnapshot(run);
  assert.equal(extracted.extracted, true);
  assert.equal(extracted.companions.filter((entry) => entry.companionId === "ember-cohort").length, 1);
  const repeat = advanceDefenseRun(queueInput(run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }), 1);
  assert.deepEqual(
    getRunSnapshot(repeat).companions.map((entry) => entry.companionId),
    extracted.companions.map((entry) => entry.companionId),
  );
});

test("boss waits for its stage gate and cleared authored waves; final completion is terminal", () => {
  const waiting = advanceWithOffers(createDefenseRun({ stageId: "cinder-span", seed: 12, companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"] }), 719);
  assert.equal(getRunSnapshot(waiting).bossSpawned, false);
  const final = advanceWithOffers(createDefenseRun({ stageId: "gate-zenith", seed: 12, companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"] }), 10000);
  assert.equal(getRunSnapshot(final).terminal, "FINAL_COMPLETION");
  assert.equal(isTerminalRun(final), true);
});

test("terminal victory suppresses a growth offer when boss XP crosses the next threshold", () => {
  const { previous, snapshot } = advanceUntilWithPrevious(
    createDefenseRun({
      stageId: "cinder-span",
      seed: 12,
      companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    }),
    (candidate) => candidate.terminal === "VICTORY",
  );
  const nextGrowthThreshold = XP_GROWTH[previous.commander.level - 1];

  assert.equal(snapshot.terminal, "VICTORY");
  assert.equal(snapshot.commander.level, previous.commander.level);
  assert.ok(previous.commander.xp < nextGrowthThreshold);
  assert.ok(snapshot.commander.xp >= nextGrowthThreshold);
  assert.equal(snapshot.growthOffer, null);
});

test("terminal victory accepts a queued reward selection and closes the offer", () => {
  const terminal = advanceWithOffers(
    createDefenseRun({
      stageId: "gate-zenith",
      seed: 12,
      companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    }),
    10000,
  );
  const before = getRunSnapshot(terminal);
  assert.equal(before.terminal, "FINAL_COMPLETION");
  assert.ok(before.rewardOffer);

  const selected = advanceDefenseRun(
    queueInput(terminal, "REWARD_SELECTED", { rewardId: before.rewardOffer.choices[0] }),
    1,
  );
  const after = getRunSnapshot(selected);
  assert.equal(after.rewardOffer, null);
  assert.deepEqual(after.rewardIds, [before.rewardOffer.choices[0]]);
  assert.equal(after.events.at(-1).type, "REWARD_SELECTED");
});

test("an active zero-radius skill damages a single target", () => {
  let run = createDefenseRun({
    stageId: "cinder-span",
    seed: 4,
    companionLoadout: ["ember-cohort", "rift-lens"],
  });
  let skillId = null;

  for (let step = 0; step < 600 && !skillId; step += 1) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer) {
      const zeroRadiusSkill = snapshot.growthOffer.choices.find((id) => id === "rift-bolt" || id === "soul-lance");
      if (zeroRadiusSkill) skillId = zeroRadiusSkill;
      run = queueInput(run, "SKILL_SELECTED", { skillId: zeroRadiusSkill ?? snapshot.growthOffer.choices[0] });
    }
    run = advanceDefenseRun(run, 1);
  }

  assert.ok(skillId, "deterministic offer sequence should expose a zero-radius active skill");
  const before = getRunSnapshot(run);
  assert.ok(before.commander.skills.includes(skillId));
  assert.ok(before.enemies.length > 0);
  const beforeHp = new Map(before.enemies.map((enemy) => [enemy.id, enemy.hp]));

  const after = getRunSnapshot(
    advanceDefenseRun(queueInput(run, "SKILL_CAST", { skillId }), 1),
  );
  assert.ok(
    after.enemies.some((enemy) => enemy.hp < (beforeHp.get(enemy.id) ?? enemy.hp)),
    "casting the zero-radius skill should damage one in-range target",
  );
  assert.equal(after.events.at(-1).type, "SKILL_CAST");
  assert.equal(after.events.at(-1).skillId, skillId);
});

test("owned Bulwark Brand reduces gate breach damage", () => {
  const firstBreach = (rewardIds) => advanceUntilSnapshot(
    createDefenseRun({ stageId: "cinder-span", seed: 3, rewardIds }),
    (snapshot) => snapshot.events.some((event) => event.type === "GATE_BREACHED"),
  );
  const unbranded = firstBreach([]);
  const branded = firstBreach(["bulwark-brand"]);
  const unbrandedEvent = unbranded.events.find((event) => event.type === "GATE_BREACHED");
  const brandedEvent = branded.events.find((event) => event.type === "GATE_BREACHED");

  assert.ok(unbrandedEvent, "a deterministic wave should breach the gate");
  assert.ok(brandedEvent, "the same wave should breach the branded gate");
  assert.equal(unbrandedEvent.damage - brandedEvent.damage, 2);
  assert.equal(branded.gateDamageReduction, 2);
});

test("an item pickup applies both gate maximum and current integrity", () => {
  const { previous, snapshot } = advanceUntilWithPrevious(
    createDefenseRun({
      stageId: "veil-citadel",
      seed: 5,
      companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    }),
    (next) => next.itemIds.includes("ward-splinter"),
    2000,
  );

  assert.deepEqual(snapshot.itemIds, ["ward-splinter"]);
  assert.equal(snapshot.gate.maxIntegrity, 1080);
  assert.equal(snapshot.gate.integrity, previous.gate.integrity + 80);
  assert.equal(snapshot.progress.itemsCollected, 1);
  assert.equal(snapshot.events.at(-1).type, "ITEM_COLLECTED");
});

test("repeated ticks after an item pickup do not compound Abyssal Banner companion damage", () => {
  let run = createDefenseRun({
    stageId: "veil-citadel",
    seed: 5,
    companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
    rewardIds: ["abyssal-banner"],
  });
  const initialDamage = getRunSnapshot(run).companions.map((companion) => ({
    companionId: companion.companionId,
    damage: companion.damage,
  }));
  assert.deepEqual(initialDamage, [
    { companionId: "ember-cohort", damage: 480 },
    { companionId: "rift-lens", damage: 600 },
    { companionId: "veil-vanguard", damage: 420 },
  ]);

  for (let step = 0; step < 2000 && !getRunSnapshot(run).itemIds.length; step += 1) {
    run = advanceWithOffers(run, 1);
  }
  const afterPickup = getRunSnapshot(run);
  assert.deepEqual(afterPickup.itemIds, ["ward-splinter"]);
  assert.deepEqual(
    afterPickup.companions.map(({ companionId, damage }) => ({ companionId, damage })),
    initialDamage,
  );

  for (let step = 0; step < 30; step += 1) run = advanceWithOffers(run, 1);
  assert.deepEqual(
    getRunSnapshot(run).companions.map(({ companionId, damage }) => ({ companionId, damage })),
    initialDamage,
  );
});


test("Abyssal Banner gives a later extracted companion one bonus", () => {
  let run = createDefenseRun({
    stageId: "veil-citadel",
    seed: 5,
    companionLoadout: ["ember-cohort"],
    rewardIds: ["abyssal-banner"],
  });
  let candidate = null;
  for (let step = 0; step < 2000 && !candidate; step += 1) {
    const snapshot = getRunSnapshot(run);
    if (snapshot.growthOffer) run = queueInput(run, "SKILL_SELECTED", { skillId: snapshot.growthOffer.choices[0] });
    run = advanceDefenseRun(run, 1);
    candidate = getRunSnapshot(run).eliteCandidate;
  }

  assert.ok(candidate, "the deterministic elite should become extractable");
  run = advanceWithOffers(
    queueInput(run, "EXTRACT_ELITE", { enemyId: candidate.enemyId }),
    1,
  );
  const snapshot = getRunSnapshot(run);
  assert.equal(snapshot.extracted, true);
  assert.deepEqual(
    snapshot.companions.map(({ companionId, damage }) => ({ companionId, damage })),
    [
      { companionId: "ember-cohort", damage: 480 },
      { companionId: "rift-lens", damage: 600 },
    ],
  );
});
test("later-stage runs use the default cutscene fallback without throwing", () => {
  const run = createDefenseRun({ stageId: "sunken-bastion", seed: 2 });
  const snapshot = getRunSnapshot(advanceDefenseRun(run, 1));

  assert.deepEqual(snapshot.cutscene, CUTSCENES.default);
  assert.equal(snapshot.stageId, "sunken-bastion");
});

test("selecting an already-owned reward closes an all-owned terminal offer", () => {
  const terminal = advanceWithOffers(
    createDefenseRun({
      stageId: "gate-zenith",
      seed: 12,
      companionLoadout: ["ember-cohort", "rift-lens", "veil-vanguard"],
      rewardIds: ["dawnless-crown", "throne-echo-record", "rift-lens-archive"],
    }),
    10000,
  );
  const before = getRunSnapshot(terminal);
  assert.equal(before.terminal, "FINAL_COMPLETION");
  assert.deepEqual(
    [...before.rewardOffer.choices].sort(),
    ["dawnless-crown", "rift-lens-archive", "throne-echo-record"],
  );

  const selected = advanceDefenseRun(
    queueInput(terminal, "REWARD_SELECTED", { rewardId: before.rewardOffer.choices[0] }),
    1,
  );
  const after = getRunSnapshot(selected);
  assert.equal(after.rewardOffer, null);
  assert.deepEqual(after.rewardIds, ["dawnless-crown", "rift-lens-archive", "throne-echo-record"]);
  assert.equal(after.events.at(-1).type, "REWARD_SELECTED");
  assert.equal(after.events.at(-1).alreadyOwned, true);
});
