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
