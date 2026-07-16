import assert from "node:assert/strict";
import test from "node:test";

import {
  RULES_VERSION,
  SAVE_SCHEMA,
  SAVE_SCHEMA_VERSION,
  applyAction,
  chooseReward,
  createCampaign,
  createSaveEnvelope,
  restoreSaveEnvelope,
  retryStage,
  startCampaign,
} from "../campaign-state.js";

const COMMANDS = Object.freeze([
  "hunt",
  "extract",
  "materialize",
  "capture",
  "possess",
  "domain",
  "assault",
]);

function accept(result, label) {
  assert.equal(result.accepted, true, label ?? result.message);
  return result.state;
}

function command(state, action) {
  return accept(applyAction(state, action), `Expected ${action} to be accepted: ${state.lastMessage}`);
}

function rejectWithoutMutation(state, transition, label) {
  const before = JSON.stringify(state);
  const result = transition(state);
  assert.equal(result.accepted, false, label ?? "transition should reject");
  assert.equal(result.state, state, "a rejected transition must return the supplied state");
  assert.equal(JSON.stringify(state), before, "a rejected transition must not mutate the supplied state");
}

function start() {
  return accept(startCampaign(createCampaign()), "Campaign should start from briefing");
}

function finishCurrentStage(state) {
  let next = state;
  for (const action of ["hunt", "hunt", "extract", "materialize"]) next = command(next, action);
  while (next.stage.nodes < (next.stageIndex === 1 ? 2 : 1)) next = command(next, "capture");
  if (next.stageIndex === 1) next = command(next, "possess");
  if (next.stageIndex === 2) next = command(next, "domain");
  for (let strike = 0; strike < 3; strike += 1) next = command(next, "assault");
  assert.equal(next.status, "reward", "three legal assaults should finish the stage");
  return next;
}

function finishCampaign() {
  let state = start();
  state = accept(chooseReward(finishCurrentStage(state), "rift-lens"));
  state = accept(chooseReward(finishCurrentStage(state), "veil-vanguard"));
  state = accept(chooseReward(finishCurrentStage(state), "throne-echo"));
  return state;
}

test("public campaign API completes the deterministic three-stage Shadow Lord path", () => {
  const completed = finishCampaign();

  assert.equal(completed.status, "campaign-complete");
  assert.equal(completed.stageIndex, 2);
  assert.deepEqual(completed.rewards.map(({ stageId, rewardId }) => [stageId, rewardId]), [
    ["cinder-span", "rift-lens"],
    ["veil-citadel", "veil-vanguard"],
    ["echo-throne", "throne-echo"],
  ]);
  assert.deepEqual(completed.trace.map(({ kind }) => kind), [
    "start",
    ...Array(8).fill("action"),
    "reward",
    ...Array(10).fill("action"),
    "reward",
    ...Array(9).fill("action"),
    "reward",
  ]);
});

test("premature public commands reject without mutating campaign state", () => {
  let state = start();
  rejectWithoutMutation(state, (current) => startCampaign(current), "an active campaign cannot be started again");
  rejectWithoutMutation(state, (current) => chooseReward(current, "ember-cohort"), "rewards require a stage victory");
  for (const action of COMMANDS.filter((action) => action !== "hunt")) {
    rejectWithoutMutation(state, (current) => applyAction(current, action), `Stage 1 ${action} must be premature`);
  }

  state = accept(chooseReward(finishCurrentStage(state), "ember-cohort"));
  assert.equal(state.stageIndex, 1);
  assert.equal(state.stage.capacity, 22, "the earned Stage 1 boon must carry into Stage 2");
  for (const action of COMMANDS.filter((action) => action !== "hunt")) {
    rejectWithoutMutation(state, (current) => applyAction(current, action), `Stage 2 ${action} must be premature`);
  }

  for (const action of ["hunt", "hunt", "extract", "materialize", "capture", "capture"]) state = command(state, action);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "Stage 2 must require possession before assault");
  state = command(state, "possess");
  for (let strike = 0; strike < 3; strike += 1) state = command(state, "assault");
  state = accept(chooseReward(state, "anchor-shard"));
  assert.equal(state.stageIndex, 2);
  assert.equal(state.stage.capacity, 38, "Stage 3 must receive both capacity boons");

  rejectWithoutMutation(state, (current) => applyAction(current, "domain"), "Stage 3 domain must require the throne node");
  for (const action of ["hunt", "hunt", "extract", "materialize", "capture"]) state = command(state, action);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "Stage 3 assault must require the Domain");
  state = command(state, "domain");
  rejectWithoutMutation(state, (current) => applyAction(current, "domain"), "Stage 3 domain must be one-use");
});

test("reward choice is exclusive and retry resets the stage while retaining earned boons", () => {
  let state = start();
  const rewardState = finishCurrentStage(state);
  const beforeInvalidChoice = JSON.stringify(rewardState);
  rejectWithoutMutation(rewardState, (current) => chooseReward(current, "not-an-offer"), "unoffered rewards must reject");
  assert.equal(JSON.stringify(rewardState), beforeInvalidChoice);

  state = accept(chooseReward(rewardState, "ember-cohort"));
  assert.equal(state.rewards.length, 1);
  assert.equal(state.rewards[0].rewardId, "ember-cohort");
  rejectWithoutMutation(state, (current) => chooseReward(current, "rift-lens"), "the other Stage 1 reward cannot also be claimed");

  state = command(state, "hunt");
  const retried = accept(retryStage(state), "an active Stage 2 campaign can retry");
  assert.equal(retried.stageIndex, 1);
  assert.equal(retried.status, "active");
  assert.equal(retried.stage.hunted, 0, "retry must reset current stage progress");
  assert.equal(retried.stage.capacity, 22, "retry must preserve the earned Ember Cohort boon");
  assert.deepEqual(retried.rewards.map(({ rewardId }) => rewardId), ["ember-cohort"]);

  rejectWithoutMutation(createCampaign(), (current) => retryStage(current), "briefing cannot retry");
  rejectWithoutMutation(rewardState, (current) => retryStage(current), "reward choice cannot retry");
});

test("public retries keep a started stage save compact and playable", () => {
  let state = accept(chooseReward(finishCurrentStage(start()), "ember-cohort"));
  const stageCheckpoint = createSaveEnvelope(state);

  for (let attempt = 0; attempt < 201; attempt += 1) {
    state = command(state, "hunt");
    state = accept(retryStage(state), `retry ${attempt + 1} should be accepted`);
  }

  const envelope = createSaveEnvelope(state);
  assert.ok(envelope.trace.length < 200, "legitimate retries must not exhaust the replay budget");
  assert.deepEqual(envelope.trace, stageCheckpoint.trace, "retries must discard the abandoned stage attempt");

  const restored = restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope)));
  assert.equal(restored.status, state.status);
  assert.equal(restored.stageIndex, state.stageIndex);
  assert.deepEqual(restored.stage, state.stage);
  assert.deepEqual(restored.rewards, state.rewards);
  accept(applyAction(restored, "hunt"), "the restored compact save must remain playable");
});

test("versioned save envelopes restore deterministically and reject tampering", () => {
  const original = finishCampaign();
  const envelope = createSaveEnvelope(original);

  assert.deepEqual(envelope, {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    trace: original.trace,
  });
  assert.deepEqual(restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope))), original);

  const wrongSchema = { ...envelope, schema: "forged-schema" };
  assert.throws(() => restoreSaveEnvelope(wrongSchema), /not an Abyssal Surge save/);

  const wrongRules = { ...envelope, rulesVersion: "forged-rules" };
  assert.throws(() => restoreSaveEnvelope(wrongRules), /incompatible campaign rules/);

  const overBudgetRetries = {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    trace: Array.from({ length: 201 }, () => ({ kind: "retry" })),
  };
  assert.throws(
    () => restoreSaveEnvelope(overBudgetRetries),
    /Save trace exceeds 200 events/,
    "a syntactically valid trace over the replay budget must reject before its first invalid retry is replayed",
  );

  const impossibleTrace = JSON.parse(JSON.stringify(envelope));
  impossibleTrace.trace[1].action = "extract";
  assert.throws(() => restoreSaveEnvelope(impossibleTrace), /impossible transition/);

  const unsupportedEvent = JSON.parse(JSON.stringify(envelope));
  unsupportedEvent.trace.push({ kind: "forged" });
  assert.throws(() => restoreSaveEnvelope(unsupportedEvent), /unsupported event/);
});
