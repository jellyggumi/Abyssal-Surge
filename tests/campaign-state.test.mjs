import assert from "node:assert/strict";
import test from "node:test";

import {
  BALANCE,
  CONTENT_TRACE,
  RULES_VERSION,
  SAVE_SCHEMA,
  SAVE_SCHEMA_VERSION,
  STAGES,
  applyAction,
  applyBattleBreach,
  chooseReward,
  createCampaign,
  createSaveEnvelope,
  getCampaignBenefits,
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

// Balance-v3 reference lines preserve legal stage gates while exercising reward effects.
const ECONOMY_L4 = ["hunt", "hunt", "extract", "materialize", "materialize"];
const S1_OPTIMAL = [...ECONOMY_L4, "capture", "assault", "assault", "assault"];
const S2_LENS = [...ECONOMY_L4, "capture", "capture", "possess", "assault", "assault"];
const S3_VANGUARD_LENS = ["capture", "domain", "possess", "assault", "assault"];

function finishCampaign() {
  let state = start();
  state = accept(chooseReward(commands(state, S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  state = accept(chooseReward(commands(state, S3_VANGUARD_LENS), "throne-echo"));
  return state;
}

test("campaign benefits expose selectable reward stats and cap cooldown reduction at 50%", () => {
  const offeredRewardIds = new Set(STAGES.flatMap((stage) => stage.rewards.map((reward) => reward.id)));
  assert.equal(offeredRewardIds.has("stillwater-hourglass"), true, "the cooldown item must be selectable from a stage");
  assert.equal(offeredRewardIds.has("abyssal-banner"), true, "the summon and aegis item must be selectable from a stage");

  const rewardedState = {
    ...createCampaign(),
    rewards: [
      { stageId: "cinder-span", rewardId: "stillwater-hourglass", rewardName: "Stillwater Hourglass" },
      { stageId: "veil-citadel", rewardId: "abyssal-banner", rewardName: "Abyssal Banner" },
    ],
  };
  const benefits = getCampaignBenefits(rewardedState);

  assert.deepEqual(
    Object.keys(benefits).sort(),
    ["activeItemNames", "anchorRestore", "autoExtract", "cooldownReduction", "counterReduction", "extraAssaultDamage", "initialAegis", "lensDamage", "maxIntegrity", "summonBonus", "vanguardLegion"],
  );
  assert.equal(benefits.maxIntegrity, BALANCE.maxIntegrity);
  assert.equal(benefits.cooldownReduction, 0.2);
  assert.equal(benefits.extraAssaultDamage, 0);
  assert.equal(benefits.summonBonus, 1);
  assert.equal(benefits.autoExtract, true);
  assert.equal(benefits.initialAegis, 1);
  assert.ok(benefits.activeItemNames.includes("Stillwater Hourglass"));
  assert.ok(benefits.activeItemNames.includes("Abyssal Banner"));

  const cappedBenefits = getCampaignBenefits({
    ...rewardedState,
    rewards: Array.from({ length: 3 }, (_, index) => ({
      stageId: `test-stage-${index}`,
      rewardId: "stillwater-hourglass",
      rewardName: "Stillwater Hourglass",
    })),
  });
  assert.equal(cappedBenefits.cooldownReduction, 0.5, "stacked cooldown rewards may never exceed the 50% cap");
});

test("battle breaches consume aegis, defeat at zero integrity, and replay from saves", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "abyssal-banner"));
  assert.equal(state.status, "active");
  assert.equal(state.stage.aegis, 1, "Abyssal Banner must carry its starting aegis into the next active stage");

  const integrityBeforeAegis = state.stage.integrity;
  const absorbed = applyBattleBreach(state);
  assert.equal(absorbed.accepted, true);
  assert.equal(absorbed.effect, "battle-breach");
  state = absorbed.state;
  assert.equal(state.stage.aegis, 0, "the breach must consume aegis first");
  assert.equal(state.stage.integrity, integrityBeforeAegis, "an aegis-absorbed breach cannot cost integrity");
  assert.deepEqual(state.trace.at(-1), { kind: "battle-breach" });

  while (state.status === "active") state = accept(applyBattleBreach(state));
  assert.equal(state.status, "defeat");
  assert.equal(state.stage.integrity, 0);
  assert.deepEqual(state.trace.at(-1), { kind: "battle-breach" });
  rejectWithoutMutation(state, (current) => applyBattleBreach(current), "defeated campaigns cannot take battle breaches");
  rejectWithoutMutation(createCampaign(), (current) => applyBattleBreach(current), "briefing campaigns cannot take battle breaches");

  const envelope = createSaveEnvelope(state);
  assert.ok(envelope.trace.some((event) => event.kind === "battle-breach"), "saves must retain battle breach events");
  assert.deepEqual(restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope))), state);
});

test("public campaign API completes the deterministic three-stage Abyssal Command path", () => {
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
    ...Array(5).fill("action"),
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

test("Rift Lens adds four damage to possessed Stage 3 assaults", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "anchor-shard"));
  state = commands(state, [...ECONOMY_L4, "capture"]);

  const unpossessed = command(state, "assault");
  assert.equal(unpossessed.stage.bossHealth, 13, "unpossessed Stage 3 assault deals base 4");

  const possessed = command(command(state, "possess"), "assault");
  assert.equal(possessed.stage.bossHealth, 8, "possessed Rift Lens assault deals base 4 + possession 1 + Lens 4");
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
  assert.equal(state.stage.bossHealth, 0, "the second possessed Rift Lens strike fells the Gate Sovereign");
  assert.equal(state.stage.integrity, 10, "the two Domain aegis absorb both winning counterblows");
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

test("Ember Cohort makes the first legal Stage 2 materialize raise four shades without expanding capacity", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "ember-cohort"));
  state = commands(state, ["hunt", "hunt", "extract", "materialize"]);

  assert.equal(state.stage.legion, 4, "Cohort raises base 2 + 2 shades on the first Stage 2 materialize");
  assert.equal(state.stage.capacity, 10, "Cohort must not change the stage's legal legion capacity");
});

test("Ember Cohort and Abyssal Banner make the first legal Stage 3 materialize raise five shades", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "ember-cohort"));
  state = commands(state, [...ECONOMY_L4, "capture", "capture", "possess", "assault", "assault", "assault"]);
  state = accept(chooseReward(state, "abyssal-banner"));
  state = commands(state, ["hunt", "hunt", "extract", "materialize"]);

  assert.equal(state.stageIndex, 2);
  assert.equal(state.stage.legion, 5, "Cohort 2 + Banner 1 stack with the base two-shade materialize");
  assert.equal(state.stage.capacity, 10, "stacked summon boons still respect the fixed capacity");
});

test("Stillwater Hourglass publicly grants 20% cooldown reduction and extracts on the second Hunt", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "stillwater-hourglass"));
  assert.equal(getCampaignBenefits(state).cooldownReduction, 0.2, "Hourglass publicly reports its 20% cooldown benefit");

  state = commands(state, ["hunt", "hunt"]);
  assert.equal(state.stage.extracted, true, "the second Hunt must automatically extract the available soul cache");
  assert.equal(state.stage.hunted, 0, "automatic extraction consumes both mapped spoor");
  assert.equal(state.stage.souls, 4, "automatic extraction yields the standard four souls");
});

test("Bulwark Brand reduces a thin Stage 2 counterblow by two but never below one integrity", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "shadebreaker-brand"));
  state = commands(state, ["hunt", "hunt", "extract", "materialize", "capture", "capture", "possess"]);
  const integrityBeforeAssault = state.stage.integrity;
  state = command(state, "assault");

  assert.equal(state.stage.integrity, integrityBeforeAssault - 1, "Brand floors its reduced three-damage thin counterblow at one");
});

test("Abyssal Banner plus Lord's Domain gives three aegis and Rift Lens ends Stage 3 in two possessed strikes", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "abyssal-banner"));
  state = commands(state, ["hunt", "hunt", "extract", "materialize", "capture", "domain", "possess"]);

  assert.equal(state.stage.aegis, 3, "Banner entry aegis and Domain's two aegis stack to three");
  state = commands(state, ["assault", "assault"]);
  assert.equal(state.status, "reward", "two possessed Lens assaults after Domain must win Stage 3");
  assert.equal(state.stage.bossHealth, 0);
  assert.equal(state.stage.aegis, 1, "two winning assaults consume two of the three aegis");
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
  assert.equal(state.stage.capacity, 10, "Ember Cohort increases materialized shades without changing legal legion capacity");
  for (const action of COMMANDS.filter((action) => action !== "hunt")) {
    rejectWithoutMutation(state, (current) => applyAction(current, action), `Stage 2 ${action} must be premature`);
  }

  state = commands(state, [...ECONOMY_L4, "capture", "capture"]);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "Stage 2 must require possession before assault");
  state = command(state, "possess");
  for (let strike = 0; strike < 3; strike += 1) state = command(state, "assault");
  state = accept(chooseReward(state, "anchor-shard"));
  assert.equal(state.stageIndex, 2);
  assert.equal(state.stage.capacity, 10, "Stage 3 retains its fixed capacity after Cohort");

  rejectWithoutMutation(state, (current) => applyAction(current, "domain"), "Stage 3 domain must require the throne node");
  state = commands(state, [...ECONOMY_L4, "capture"]);
  accept(applyAction(state, "assault"), "Stage 3 assault must remain available once its node gate is met");
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
  assert.equal(retried.stage.capacity, 10, "retry preserves Cohort while capacity remains fixed");
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

test("versioned v3 save envelopes replay deterministically and reject tampering", () => {
  const original = finishCampaign();
  const envelope = createSaveEnvelope(original);

  assert.deepEqual(envelope, {
    schema: SAVE_SCHEMA,
    schemaVersion: 2,
    rulesVersion: "abyssal-surge-rules-v3",
    trace: original.trace,
  });
  assert.equal(SAVE_SCHEMA_VERSION, 2);
  assert.equal(RULES_VERSION, "abyssal-surge-rules-v3");
  assert.deepEqual(
    restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope))),
    original,
    "a v3 envelope must deterministically replay every legal reward route",
  );

  const wrongSchema = { ...envelope, schema: "forged-schema" };
  assert.throws(() => restoreSaveEnvelope(wrongSchema), /not an Abyssal Command save/);

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

test("pre-v3 save envelopes are explicitly rejected", () => {
  const v1Envelope = {
    schema: SAVE_SCHEMA,
    schemaVersion: 1,
    rulesVersion: "abyssal-surge-rules-v1",
    trace: [{ kind: "start" }, { kind: "action", action: "hunt" }],
  };
  assert.throws(
    () => restoreSaveEnvelope(v1Envelope),
    /v1 balance rules and cannot continue in v3/,
    "a v1 envelope must fail with the migration explanation, not a generic schema error",
  );

  const v2Envelope = {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: "abyssal-surge-rules-v2",
    trace: [{ kind: "start" }, { kind: "action", action: "hunt" }],
  };
  assert.throws(
    () => restoreSaveEnvelope(v2Envelope),
    /incompatible campaign rules/,
    "a v2 envelope must reject rather than replaying under the rebalanced v3 rules",
  );
});

test("content trace inventory covers every stage, boss, and offered reward", () => {
  const traceIds = [];
  const traceIdPattern = /^AS-WV-\d{3}$/;

  const requireTrace = (traceId, expected) => {
    assert.match(traceId, traceIdPattern, "content trace IDs must use the AS-WV-### inventory form");
    traceIds.push(traceId);
    assert.deepEqual(CONTENT_TRACE[traceId], expected, `content trace ${traceId} must describe its referenced campaign content`);
  };

  for (const stage of STAGES) {
    assert.deepEqual(Object.keys(stage.trace.stage).sort(), ["description", "name", "region"]);
    assert.deepEqual(Object.keys(stage.trace.boss).sort(), ["description", "name"]);
    assert.deepEqual(
      Object.keys(stage.trace.rewards).sort(),
      stage.rewards.map((reward) => reward.id).sort(),
      `${stage.id} must trace every offered reward`,
    );

    for (const [field, value] of Object.entries({
      name: stage.title,
      region: stage.region,
      description: stage.objective,
    })) {
      requireTrace(stage.trace.stage[field], {
        stageId: stage.id,
        entity: "stage",
        field,
        value,
      });
    }

    requireTrace(stage.trace.boss.name, {
      stageId: stage.id,
      entity: "boss",
      field: "name",
      value: stage.bossName,
    });
    const bossDescription = CONTENT_TRACE[stage.trace.boss.description];
    assert.match(stage.trace.boss.description, traceIdPattern, "boss descriptions must have an AS-WV trace ID");
    traceIds.push(stage.trace.boss.description);
    assert.deepEqual(
      {
        stageId: bossDescription?.stageId,
        entity: bossDescription?.entity,
        field: bossDescription?.field,
      },
      {
        stageId: stage.id,
        entity: "boss",
        field: "description",
      },
      `${stage.id} boss description must be traceable`,
    );
    assert.equal(typeof bossDescription?.value, "string");
    assert.notEqual(bossDescription.value.trim(), "");

    for (const reward of stage.rewards) {
      const rewardTrace = stage.trace.rewards[reward.id];
      assert.deepEqual(Object.keys(rewardTrace).sort(), ["description", "name"]);
      for (const [field, value] of Object.entries({
        name: reward.name,
        description: reward.description,
      })) {
        requireTrace(rewardTrace[field], {
          stageId: stage.id,
          entity: "reward",
          rewardId: reward.id,
          field,
          value,
        });
      }
    }
  }

  assert.equal(new Set(traceIds).size, traceIds.length, "each campaign content field must have its own trace ID");
  assert.deepEqual(
    Object.keys(CONTENT_TRACE).sort(),
    [...traceIds].sort(),
    "the public content inventory must have no orphaned or unreachable trace entries",
  );
});

test("BALANCE publishes the tuned v3 reward knobs the simulator measured", () => {
  assert.deepEqual([...BALANCE.counterBase], [1, 2, 8]);
  assert.equal(BALANCE.shieldDivisor, 4);
  assert.equal(BALANCE.thinPenalty, 1);
  assert.equal(BALANCE.rewardRestore, 1);
  assert.equal(BALANCE.domainRestore, 4);
  assert.equal(BALANCE.domainAegis, 2);
  assert.equal(BALANCE.cohortSummonBonus, 2);
  assert.equal(BALANCE.lensDamage, 4);
  assert.equal(BALANCE.hourglassCooldownReduction, 0.2);
  assert.equal(BALANCE.bannerSummonBonus, 1);
  assert.equal(BALANCE.bannerInitialAegis, 1);
  assert.equal(BALANCE.brandCounterReduction, 2);
});
