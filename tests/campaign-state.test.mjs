import assert from "node:assert/strict";
import test from "node:test";

import {
  BALANCE,
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

function commands(state, actions) {
  let next = state;
  for (const action of actions) next = command(next, action);
  return next;
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

// Balance-v2 reference lines (counterBase [1,2,8], rewardRestore 1).
const ECONOMY_L4 = ["hunt", "hunt", "extract", "materialize", "materialize"];
const S1_OPTIMAL = [...ECONOMY_L4, "capture", "assault", "assault", "assault"];
const S2_LENS = [...ECONOMY_L4, "capture", "capture", "possess", "assault", "assault"];
const S3_VANGUARD_LENS = ["capture", "domain", "possess", "assault", "assault", "assault"];

function finishCampaign() {
  let state = start();
  state = accept(chooseReward(commands(state, S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  state = accept(chooseReward(commands(state, S3_VANGUARD_LENS), "throne-echo"));
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
    ...Array(9).fill("action"),
    "reward",
    ...Array(10).fill("action"),
    "reward",
    ...Array(6).fill("action"),
    "reward",
  ]);
});

test("boss counterblows scale by stage and are softened by the legion shield", () => {
  // Stage 1, thin legion (L2 < 3): counter = max(1, 1) + 1 thin = 2.
  let thin = commands(start(), ["hunt", "hunt", "extract", "materialize", "capture"]);
  thin = command(thin, "assault");
  assert.equal(thin.stage.bossHealth, 5, "Stage 1 assault must deal 3 damage");
  assert.equal(thin.stage.integrity, 8, "a thin Stage 1 assault must cost 2 integrity");

  // Same run, shielded legion (L4, floor(4/4)=1 shield, not thin): counter 1.
  thin = command(thin, "materialize");
  assert.equal(thin.stage.legion, 4);
  const shielded = command(thin, "assault");
  assert.equal(shielded.stage.integrity, 7, "a shielded Stage 1 assault must cost only 1 integrity");
});

test("integrity persists across stages instead of resetting to 10", () => {
  // Thin Stage 1 rush: three counterblows of 2 leave integrity 4.
  let state = commands(start(), ["hunt", "hunt", "extract", "materialize", "capture", "assault", "assault", "assault"]);
  assert.equal(state.status, "reward");
  assert.equal(state.stage.integrity, 4);

  state = accept(chooseReward(state, "rift-lens"));
  assert.equal(state.stageIndex, 1);
  assert.equal(state.stage.integrity, 5, "Stage 2 must open with carried integrity 4 + reward restore 1, not 10");
  assert.equal(state.stage.entryIntegrity, 5, "the stage entry snapshot must record the carried value");
});

test("Stage 3 possession turns possess into a real damage choice", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "anchor-shard"));
  state = commands(state, [...ECONOMY_L4, "capture"]);

  const unpossessed = command(state, "assault");
  assert.equal(unpossessed.stage.bossHealth, 13, "unpossessed Stage 3 assault deals base 4");

  const possessed = command(command(state, "possess"), "assault");
  assert.equal(possessed.stage.bossHealth, 11, "possessed assault with Rift Lens deals 4 + 1 + 1 = 6");
});

test("Lord's Domain restores 4 integrity and its aegis negates the next two counterblows", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  assert.equal(state.stage.legion, 4, "Veil Vanguard must open Echo Throne with four shades");
  assert.equal(state.stage.integrity, 7);

  state = command(state, "capture");
  state = command(state, "domain");
  assert.equal(state.stage.integrity, 10, "Domain must restore 4 integrity (clamped)");
  assert.equal(state.stage.aegis, 2);
  rejectWithoutMutation(state, (current) => applyAction(current, "domain"), "Domain must be one-use");

  state = command(state, "possess");
  state = command(state, "assault");
  assert.equal(state.stage.integrity, 10, "first counterblow breaks on the aegis");
  assert.equal(state.stage.aegis, 1);
  state = command(state, "assault");
  assert.equal(state.stage.integrity, 10, "second counterblow breaks on the aegis");
  assert.equal(state.stage.aegis, 0);
  state = command(state, "assault");
  assert.equal(state.stage.bossHealth, 0, "third strike fells the Gate Sovereign");
  assert.equal(state.stage.integrity, 2, "the exposed killing blow still costs the full counter (8)");
  assert.equal(state.status, "reward");
});

test("thin legions take the reckless-assault penalty", () => {
  // Stage 3 thin threshold is legion < 5: a 4-shade vanguard is still thin.
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  state = commands(state, ["capture", "assault"]);
  // counter at L4: max(1, 8 - 1) + 1 thin = 8.
  assert.equal(state.stage.integrity, 0, "counter 8 must exhaust the carried integrity of 7");
  assert.equal(state.status, "defeat", "an undefended thin assault into the Gate Sovereign is lethal");

  // Same position with a fatter legion (L8): counter max(1, 8-2) = 6, no thin penalty.
  let fat = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  fat = accept(chooseReward(commands(fat, S2_LENS), "veil-vanguard"));
  fat = commands(fat, ["hunt", "hunt", "extract", "materialize", "materialize", "capture", "assault"]);
  assert.equal(fat.stage.legion, 8);
  assert.equal(fat.stage.integrity, 1, "an 8-shade legion softens the same counterblow to 6");
  assert.equal(fat.status, "active");
});

test("defeat is reachable: the thin rush dies on Echo Throne and retry restores the stage entry", () => {
  const thinLine = ["hunt", "hunt", "extract", "materialize"];
  let state = commands(start(), [...thinLine, "capture", "assault", "assault", "assault"]);
  state = accept(chooseReward(state, "rift-lens"));
  state = commands(state, [...thinLine, "capture", "capture", "possess", "assault", "assault"]);
  assert.equal(state.status, "reward", "the thin Stage 2 line survives on the killing blow");
  assert.equal(state.stage.integrity, 0);
  state = accept(chooseReward(state, "anchor-shard"));
  assert.equal(state.stage.integrity, 3, "Echo Throne entry = 0 + restore 1 + Anchor Shard 2");

  state = commands(state, [...thinLine, "capture", "assault"]);
  assert.equal(state.status, "defeat", "the first undefended Echo Throne assault must be lethal");
  assert.equal(state.stage.integrity, 0);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "a defeated stage accepts no commands");

  const retried = accept(retryStage(state), "defeat must allow a retry");
  assert.equal(retried.status, "active");
  assert.equal(retried.stage.integrity, 3, "retry must restore the recorded stage-entry integrity");
  assert.equal(retried.stage.nodes, 0, "retry must reset stage progress");
  assert.deepEqual(retried.rewards.map(({ rewardId }) => rewardId), ["rift-lens", "anchor-shard"]);
});

test("the soul economy loop is repeatable and bounded by legion capacity", () => {
  let state = commands(start(), ["hunt", "hunt", "extract"]);
  assert.equal(state.stage.souls, 4);
  assert.equal(state.stage.hunted, 0, "extraction consumes the mapped spoor");

  state = commands(state, ["materialize", "materialize"]);
  assert.equal(state.stage.legion, 4);
  assert.equal(state.stage.souls, 0);

  state = commands(state, ["hunt", "hunt", "extract", "materialize", "materialize", "hunt", "hunt", "extract", "materialize"]);
  assert.equal(state.stage.legion, 10, "the loop may fill every slot");
  rejectWithoutMutation(state, (current) => applyAction(current, "materialize"), "a full legion cannot materialize");
});

test("premature public commands reject without mutating campaign state", () => {
  let state = start();
  rejectWithoutMutation(state, (current) => startCampaign(current), "an active campaign cannot be started again");
  rejectWithoutMutation(state, (current) => chooseReward(current, "ember-cohort"), "rewards require a stage victory");
  for (const action of COMMANDS.filter((action) => action !== "hunt")) {
    rejectWithoutMutation(state, (current) => applyAction(current, action), `Stage 1 ${action} must be premature`);
  }

  state = accept(chooseReward(commands(state, S1_OPTIMAL), "ember-cohort"));
  assert.equal(state.stageIndex, 1);
  assert.equal(state.stage.capacity, 22, "the earned Stage 1 boon must carry into Stage 2");
  for (const action of COMMANDS.filter((action) => action !== "hunt")) {
    rejectWithoutMutation(state, (current) => applyAction(current, action), `Stage 2 ${action} must be premature`);
  }

  state = commands(state, [...ECONOMY_L4, "capture", "capture"]);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "Stage 2 must require possession before assault");
  state = command(state, "possess");
  for (let strike = 0; strike < 3; strike += 1) state = command(state, "assault");
  state = accept(chooseReward(state, "anchor-shard"));
  assert.equal(state.stageIndex, 2);
  assert.equal(state.stage.capacity, 22, "Stage 3 keeps the Ember Cohort capacity boon");

  rejectWithoutMutation(state, (current) => applyAction(current, "domain"), "Stage 3 domain must require the throne node");
  state = commands(state, [...ECONOMY_L4, "capture"]);
  accept(applyAction(state, "assault"), "Stage 3 assault must NOT be gated on the Domain (v2)");
  state = command(state, "domain");
  rejectWithoutMutation(state, (current) => applyAction(current, "domain"), "Stage 3 domain must be one-use");
});

test("reward choice is exclusive and retry resets the stage while retaining earned boons", () => {
  let state = start();
  const rewardState = commands(state, S1_OPTIMAL);
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
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "ember-cohort"));
  const stageCheckpoint = createSaveEnvelope(state);

  for (let attempt = 0; attempt < 201; attempt += 1) {
    state = command(state, "hunt");
    state = accept(retryStage(state), `retry ${attempt + 1} should be accepted`);
  }

  const envelope = createSaveEnvelope(state);
  assert.ok(envelope.trace.length < 400, "legitimate retries must not exhaust the replay budget");
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
    schemaVersion: 2,
    rulesVersion: "abyssal-surge-rules-v2",
    trace: original.trace,
  });
  assert.equal(SAVE_SCHEMA_VERSION, 2);
  assert.equal(RULES_VERSION, "abyssal-surge-rules-v2");
  assert.deepEqual(restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope))), original);

  const wrongSchema = { ...envelope, schema: "forged-schema" };
  assert.throws(() => restoreSaveEnvelope(wrongSchema), /not an Abyssal Surge save/);

  const wrongRules = { ...envelope, rulesVersion: "forged-rules" };
  assert.throws(() => restoreSaveEnvelope(wrongRules), /incompatible campaign rules/);

  const overBudgetRetries = {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    trace: Array.from({ length: 401 }, () => ({ kind: "retry" })),
  };
  assert.throws(
    () => restoreSaveEnvelope(overBudgetRetries),
    /Save trace exceeds 400 events/,
    "a syntactically valid trace over the replay budget must reject before its first invalid retry is replayed",
  );

  const impossibleTrace = JSON.parse(JSON.stringify(envelope));
  impossibleTrace.trace[1].action = "extract";
  assert.throws(() => restoreSaveEnvelope(impossibleTrace), /impossible transition/);

  const unsupportedEvent = JSON.parse(JSON.stringify(envelope));
  unsupportedEvent.trace.push({ kind: "forged" });
  assert.throws(() => restoreSaveEnvelope(unsupportedEvent), /unsupported event/);
});

test("v1 save envelopes are rejected with a clear migration message", () => {
  const v1Envelope = {
    schema: SAVE_SCHEMA,
    schemaVersion: 1,
    rulesVersion: "abyssal-surge-rules-v1",
    trace: [{ kind: "start" }, { kind: "action", action: "hunt" }],
  };
  assert.throws(
    () => restoreSaveEnvelope(v1Envelope),
    /v1 balance rules and cannot continue in v2/,
    "a v1 envelope must fail with the migration explanation, not a generic schema error",
  );
});

test("BALANCE publishes the tuned v2 knobs the simulator measured", () => {
  assert.deepEqual([...BALANCE.counterBase], [1, 2, 8]);
  assert.equal(BALANCE.shieldDivisor, 4);
  assert.equal(BALANCE.thinPenalty, 1);
  assert.equal(BALANCE.rewardRestore, 1);
  assert.equal(BALANCE.domainRestore, 4);
  assert.equal(BALANCE.domainAegis, 2);
  assert.equal(BALANCE.vanguardLegion, 4);
  assert.equal(BALANCE.anchorRestore, 2);
});
