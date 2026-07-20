import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAction,
  applyEncounterEvent,
  createCampaign,
  startCampaign
} from "../campaign-state.js";

function accept(result, label) {
  assert.equal(result.accepted, true, label ? `${label}: ${result.message}` : result.message);
  return result.state;
}

function start() {
  return accept(startCampaign(createCampaign()));
}

function huntTwiceExtract(state) {
  state = accept(applyAction(state, "hunt"));
  state = accept(applyAction(state, "hunt"));
  return accept(applyAction(state, "extract"));
}

test("hunting is bounded: repeated hunt/extract cycles are eventually rejected without mutating state", () => {
  let state = start();
  const cap = 14; // STANDARD_PROGRESSION.maxExtractions
  for (let i = 0; i < cap; i += 1) {
    state = huntTwiceExtract(state);
  }
  assert.equal(state.stage.extractions, cap);

  const before = JSON.stringify(state);
  const rejected = applyAction(state, "hunt");
  assert.equal(rejected.accepted, false);
  assert.match(rejected.message, /exhausted/);
  assert.equal(JSON.stringify(rejected.state), before, "a rejected hunt must not mutate state");
});

test("capturing ground refunds one hunting cycle (territory yield)", () => {
  let state = start();
  // Reach the cap purely through hunting.
  for (let i = 0; i < 14; i += 1) state = huntTwiceExtract(state);
  const rejectedBefore = applyAction(state, "hunt");
  assert.equal(rejectedBefore.accepted, false);

  // Build a legion large enough to capture (requires >= 2 legion).
  state = accept(applyAction(state, "materialize"));
  assert.ok(state.stage.legion >= 2, "materialize must raise a capturable legion");
  state = accept(applyAction(state, "capture"));
  assert.equal(state.stage.extractions, 13, "capture must refund exactly one extraction");

  // The refunded cycle is spendable again.
  state = accept(applyAction(state, "hunt"));
  assert.equal(state.stage.hunted, 1);
});

test("clearing a wave refunds one hunting cycle (kill-drop), and boss exposure refunds a second (terrain-change mineral)", () => {
  let state = start(); // cinder-span: 3 waves, preparationLegion 4 / preparationNodes 1
  for (let i = 0; i < 14; i += 1) state = huntTwiceExtract(state);
  assert.equal(state.stage.extractions, 14);

  // Meet the wave-start preparation gate (4 legion, 1 node); capture also
  // refunds a cycle, which the assertions below account for explicitly.
  state = accept(applyAction(state, "materialize"));
  state = accept(applyAction(state, "capture"));
  state = accept(applyAction(state, "materialize"));
  assert.ok(state.stage.legion >= 4 && state.stage.nodes >= 1, "preparation gate must be met before start-wave");

  state = accept(applyEncounterEvent(state, { type: "start-wave", stageId: state.stageId, waveId: "scout" }));
  const beforeFirstClear = state.stage.extractions;
  state = accept(applyEncounterEvent(state, { type: "wave-cleared", stageId: state.stageId, waveId: "scout" }));
  assert.equal(state.stage.extractions, Math.max(0, beforeFirstClear - 1), "a non-final wave clear refunds exactly one cycle");

  state = accept(applyEncounterEvent(state, { type: "start-wave", stageId: state.stageId, waveId: "guard" }));
  const beforeSecondClear = state.stage.extractions;
  state = accept(applyEncounterEvent(state, { type: "wave-cleared", stageId: state.stageId, waveId: "guard" }));
  assert.equal(state.stage.extractions, Math.max(0, beforeSecondClear - 1));

  state = accept(applyEncounterEvent(state, { type: "start-wave", stageId: state.stageId, waveId: "reinforcement" }));
  const beforeFinalClear = state.stage.extractions;
  state = accept(applyEncounterEvent(state, { type: "wave-cleared", stageId: state.stageId, waveId: "reinforcement" }));
  assert.equal(state.stage.encounter.bossExposed, true);
  assert.equal(
    state.stage.extractions,
    Math.max(0, beforeFinalClear - 2),
    "the wave clear that exposes the boss refunds twice: kill-drop + terrain-change mineral",
  );
});

test("the extraction cap resets per stage", () => {
  let state = start();
  for (let i = 0; i < 14; i += 1) state = huntTwiceExtract(state);
  assert.equal(state.stage.extractions, 14);
  // A fresh stage state (as built by chooseReward's makeStageState) always
  // starts extractions at 0 regardless of the prior stage's usage; assert
  // the initial shape here since walking a full stage clear is covered by
  // the balance simulator and the 10-stage completion test.
  const fresh = createCampaign();
  assert.equal(fresh.stage.extractions, 0);
});
