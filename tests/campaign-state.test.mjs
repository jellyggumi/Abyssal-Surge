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
  applyEncounterEvent,
  chooseReward,
  createCampaign,
  createSaveEnvelope,
  getCampaignBenefits,
  getStageChecklist,
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

function encounter(state, type, waveId) {
  return accept(
    applyEncounterEvent(state, { type, stageId: state.stageId, waveId }),
    `Expected ${type} for ${waveId} to be accepted: ${state.lastMessage}`,
  );
}

function commands(state, actions) {
  let next = state;
  for (const action of actions) {
    next = typeof action === "string"
      ? command(next, action)
      : encounter(next, action.type, action.waveId);
  }
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

// Balance-v5 reference lines preserve legal stage gates while exercising reward effects.
const ECONOMY_L4 = ["hunt", "hunt", "extract", "materialize", "materialize"];
const S1_ENCOUNTER = Object.freeze([
  { type: "start-wave", waveId: "scout" },
  { type: "wave-cleared", waveId: "scout" },
  { type: "start-wave", waveId: "guard" },
  { type: "wave-cleared", waveId: "guard" },
  { type: "start-wave", waveId: "reinforcement" },
  { type: "wave-cleared", waveId: "reinforcement" },
]);
const S1_OPTIMAL = [...ECONOMY_L4, "capture", ...S1_ENCOUNTER, "assault", "assault", "assault"];
const S2_LENS = [...ECONOMY_L4, "capture", "capture", "possess", "assault", "assault"];
const S3_VANGUARD_LENS = ["capture", "domain", "possess", "assault", "assault"];

// Deterministic late-campaign reward line: one legal pick per stage 4-10.
const LATE_REWARDS = Object.freeze({
  "sunken-bastion": "tidebreaker-sigil",
  "howling-sprawl": "pack-banner",
  "glass-necropolis": "glass-chorus",
  "starless-canal": "canal-lantern",
  "shattered-causeway": "causeway-core",
  "abyss-chancel": "chancel-veil",
  "gate-zenith": "zenith-crown",
});

function legionTarget(stage) {
  const counter = stage.commands.assault.counter;
  return counter.mode === "threshold" ? counter.minimumLegion : counter.thinLegion;
}

// Soul-economy loop from the verified balance line: materialize when souls
// allow, extract when the spoor is mapped, hunt otherwise.
function buildLegion(state, target) {
  const progression = STAGES[state.stageIndex].progression;
  while (state.stage.legion < target) {
    if (state.stage.souls >= progression.materializeCost && state.stage.legion < state.stage.capacity) {
      state = command(state, "materialize");
    } else if (state.stage.hunted >= progression.huntGoal) {
      state = command(state, "extract");
    } else {
      state = command(state, "hunt");
    }
  }
  return state;
}

// Clears every declared wave in schedule order after proving the schedule is
// enforced: the second declared wave must reject while the first is uncleared.
function clearDeclaredWaves(state) {
  const stage = STAGES[state.stageIndex];
  const waves = stage.encounter.waves;
  rejectWithoutMutation(
    state,
    (current) => applyEncounterEvent(current, { type: "start-wave", stageId: stage.id, waveId: waves[1].id }),
    `${stage.id}: the ${waves[1].id} wave must not start before ${waves[0].id} clears`,
  );
  for (const wave of waves) {
    state = encounter(state, "start-wave", wave.id);
    state = encounter(state, "wave-cleared", wave.id);
  }
  return state;
}

// One late stage (4-10) on the verified deterministic line: clear the declared
// encounter, build the legion past the thin threshold, take every node, spend
// possess/domain where the stage offers them, then assault to the reward.
function clearLateStage(state) {
  const stage = STAGES[state.stageIndex];
  assert.equal(state.stage.bossHealth, stage.bossHealth, `${stage.id} must open at its declared ${stage.bossHealth} boss health`);
  state = clearDeclaredWaves(state);
  state = buildLegion(state, legionTarget(stage));
  while (state.stage.nodes < stage.nodeGoal) state = command(state, "capture");
  if (stage.commands.possess) state = command(state, "possess");
  if (stage.commands.domain) state = command(state, "domain");
  while (state.status === "active") state = command(state, "assault");
  assert.equal(state.status, "reward", `${stage.id} must end in a reward choice, not ${state.status}: ${state.lastMessage}`);
  return accept(chooseReward(state, LATE_REWARDS[stage.id]));
}

function finishCampaign() {
  let state = start();
  state = accept(chooseReward(commands(state, S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  state = accept(chooseReward(commands(state, S3_VANGUARD_LENS), "throne-echo"));
  while (state.status === "active") state = clearLateStage(state);
  return state;
}

test("campaign benefits expose selectable reward stats", () => {
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

});

test("hunt checklist reports live spoor progress after extraction", () => {
  let state = commands(start(), ["hunt", "hunt", "extract"]);
  const extractedHunt = getStageChecklist(state).find(({ id }) => id === "hunt");
  assert.deepEqual(extractedHunt, {
    id: "hunt",
    label: "Hunt 0/2 rift spoor",
    complete: true,
  }, "extraction keeps the Hunt objective complete while showing reset spoor progress");

  state = command(state, "hunt");
  const repeatedHunt = getStageChecklist(state).find(({ id }) => id === "hunt");
  assert.deepEqual(repeatedHunt, {
    id: "hunt",
    label: "Hunt 1/2 rift spoor",
    complete: true,
  }, "an accepted repeat Hunt updates the displayed spoor progress without reopening the objective");
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

test("public campaign API completes the deterministic ten-stage Abyssal Command path", () => {
  // Stages 1-3: the established balance reference line, unchanged.
  let state = start();
  state = accept(chooseReward(commands(state, S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  state = accept(chooseReward(commands(state, S3_VANGUARD_LENS), "throne-echo"));

  // Echo Throne's reward no longer ends the campaign: it opens Stage 4.
  assert.equal(state.status, "active", "the third reward must advance the campaign instead of completing it");
  assert.equal(state.stageIndex, 3);
  assert.equal(state.stageId, "sunken-bastion");

  // Stages 4-10 on the verified deterministic line. Each stage asserts its
  // declared boss health at entry (inside clearLateStage), keeps the replay
  // trace within budget, and must restore identically from a save envelope.
  for (let stageIndex = 3; stageIndex < STAGES.length; stageIndex += 1) {
    assert.equal(state.stageIndex, stageIndex, `the reward chain must advance into ${STAGES[stageIndex].id}`);
    state = clearLateStage(state);
    assert.ok(state.trace.length <= 400, `the trace after ${STAGES[stageIndex].id} must stay within the 400-event replay budget`);
    assert.deepEqual(
      restoreSaveEnvelope(JSON.parse(JSON.stringify(createSaveEnvelope(state)))),
      state,
      `the save envelope after ${STAGES[stageIndex].id} must restore the identical campaign state`,
    );
  }

  assert.equal(state.status, "campaign-complete");
  assert.equal(state.stageIndex, 9);
  assert.deepEqual(state.rewards.map(({ stageId, rewardId }) => [stageId, rewardId]), [
    ["cinder-span", "rift-lens"],
    ["veil-citadel", "veil-vanguard"],
    ["echo-throne", "throne-echo"],
    ["sunken-bastion", "tidebreaker-sigil"],
    ["howling-sprawl", "pack-banner"],
    ["glass-necropolis", "glass-chorus"],
    ["starless-canal", "canal-lantern"],
    ["shattered-causeway", "causeway-core"],
    ["abyss-chancel", "chancel-veil"],
    ["gate-zenith", "zenith-crown"],
  ], "the campaign must earn exactly one reward per stage, in declared chain order");

  const kinds = state.trace.map(({ kind }) => kind);
  assert.deepEqual(kinds.slice(0, 34), [
    "start",
    ...Array(6).fill("action"),
    ...Array(6).fill("encounter"),
    ...Array(3).fill("action"),
    "reward",
    ...Array(10).fill("action"),
    "reward",
    ...Array(5).fill("action"),
    "reward",
  ], "the preserved stage 1-3 line must replay with its established event shape");
  assert.equal(kinds.filter((kind) => kind === "reward").length, 10, "the trace must record exactly one reward event per stage");
  assert.equal(kinds.at(-1), "reward", "the campaign must end on the final reward choice");

  assert.equal(
    state.lastMessage,
    "Zenith Crown is claimed. The Abyss Regent is gone, and Abyssal Command endures.",
  );
});

test("stage 4-10 declared encounters expose the boss only after every wave clears", () => {
  for (const stage of STAGES.slice(3)) {
    assert.ok(stage.encounter, `${stage.id} must declare an encounter that guards its boss`);
    assert.ok(stage.encounter.waves.length >= 4, `${stage.id} must declare its full wave schedule`);
  }

  // Enter Sunken Bastion with every non-encounter assault prerequisite met.
  let state = start();
  state = accept(chooseReward(commands(state, S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "veil-vanguard"));
  state = accept(chooseReward(commands(state, S3_VANGUARD_LENS), "throne-echo"));
  const stage = STAGES[state.stageIndex];
  assert.equal(stage.id, "sunken-bastion");

  state = buildLegion(state, legionTarget(stage));
  while (state.stage.nodes < stage.nodeGoal) state = command(state, "capture");

  // With nodes held and the legion ready, only the declared encounter gates the boss.
  rejectWithoutMutation(
    state,
    (current) => applyAction(current, "assault"),
    "the Stage 4 boss must stay protected while declared waves remain",
  );

  const waves = stage.encounter.waves;
  for (const wave of waves.slice(0, -1)) {
    state = encounter(state, "start-wave", wave.id);
    state = encounter(state, "wave-cleared", wave.id);
  }
  assert.equal(state.stage.encounter.bossExposed, false, "the boss stays protected until the final declared wave clears");
  rejectWithoutMutation(
    state,
    (current) => applyAction(current, "assault"),
    "one remaining declared wave must still block the boss assault",
  );

  const lastWave = waves.at(-1);
  state = encounter(state, "start-wave", lastWave.id);
  state = encounter(state, "wave-cleared", lastWave.id);
  assert.equal(state.stage.encounter.bossExposed, true, "clearing the final declared wave exposes the boss");
  assert.equal(state.stage.encounter.spawningStopped, true, "clearing the final declared wave stops spawning");

  const struck = accept(applyAction(state, "assault"), "the exposed Stage 4 boss must accept the assault");
  assert.equal(struck.stage.bossHealth, stage.bossHealth - stage.commands.assault.damage, "the first legal assault must land its declared damage");
});

test("Stage 1 encounter accepts only the active declared wave and exposes the boss after the third clear", () => {
  const stage = STAGES[0];
  assert.deepEqual(
    stage.encounter,
    {
      preparationSeconds: 8,
      preparationLegion: 2,
      waves: [
        { id: "scout", spawnAtSeconds: 8, hostiles: 2, hostileHealth: 2, breachDamage: 1 },
        { id: "guard", spawnAtSeconds: 22, hostiles: 3, hostileHealth: 2, breachDamage: 1 },
        { id: "reinforcement", spawnAtSeconds: 36, hostiles: 3, hostileHealth: 2, breachDamage: 1 },
      ],
    },
    "Stage 1 must publish the declared 8/22/36 second 2/3/3 hostile encounter schedule.",
  );

  let state = commands(start(), ["hunt", "hunt", "extract", "materialize", "capture"]);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "Stage 1 assault must remain blocked before the encounter clears");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "start-wave", stageId: stage.id, waveId: "guard" }), "the second wave cannot start before Scout");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "wave-cleared", stageId: stage.id, waveId: "scout" }), "a wave cannot clear before it starts");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "breach", stageId: "veil-citadel", waveId: "scout" }), "a mismatched stage event must not mutate Stage 1");

  state = encounter(state, "start-wave", "scout");
  assert.equal(state.stage.encounter.activeWaveId, "scout", "start-wave activates the next scheduled wave");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "start-wave", stageId: stage.id, waveId: "scout" }), "a duplicate start must leave the active wave unchanged");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "breach", stageId: stage.id, waveId: "guard" }), "a mismatched wave event must leave the active wave unchanged");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "wave-cleared", stageId: stage.id, waveId: "guard" }), "an out-of-order clear must leave the active wave unchanged");

  state = encounter(state, "breach", "scout");
  assert.equal(state.stage.encounter.waves[0].breaches, 1, "a valid breach is recorded against the active wave");
  state = encounter(state, "wave-cleared", "scout");
  assert.equal(state.stage.encounter.activeWaveId, null, "clearing a wave resets the active wave");
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "breach", stageId: stage.id, waveId: "scout" }), "a cleared wave cannot receive duplicate events");

  state = encounter(state, "start-wave", "guard");
  state = encounter(state, "wave-cleared", "guard");
  assert.equal(state.stage.encounter.bossExposed, false, "the boss remains protected until all three waves clear");
  assert.equal(state.stage.encounter.spawningStopped, false, "spawning remains available until the final clear");

  state = encounter(state, "start-wave", "reinforcement");
  state = encounter(state, "wave-cleared", "reinforcement");
  assert.deepEqual(
    state.stage.encounter,
    {
      waves: [
        { id: "scout", cleared: true, breaches: 1 },
        { id: "guard", cleared: true, breaches: 0 },
        { id: "reinforcement", cleared: true, breaches: 0 },
      ],
      activeWaveId: null,
      bossExposed: true,
      spawningStopped: true,
    },
    "the third clear exposes the boss and permanently stops wave spawning",
  );
  rejectWithoutMutation(state, (current) => applyEncounterEvent(current, { type: "start-wave", stageId: stage.id, waveId: "reinforcement" }), "the completed encounter must reject further spawning");
  assert.equal(applyAction(state, "assault").accepted, true, "Stage 1 assault becomes legal only after the final wave clear and normal node prerequisite");
});

test("boss counterblows scale by stage and are softened by the legion shield", () => {
  // Stage 1, thin legion (L2 < 3): counter = max(1, 1) + 1 thin = 2.
  let thin = commands(start(), ["hunt", "hunt", "extract", "materialize", "capture", ...S1_ENCOUNTER]);
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
  let state = commands(start(), ["hunt", "hunt", "extract", "materialize", "capture", ...S1_ENCOUNTER, "assault", "assault", "assault"]);
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

test("Stage 3 keeps Possess optional after capture while Rift Lens resolves the 17-health boss in two nine-damage assaults", () => {
  let state = accept(chooseReward(commands(start(), S1_OPTIMAL), "rift-lens"));
  state = accept(chooseReward(commands(state, S2_LENS), "anchor-shard"));
  state = commands(state, ECONOMY_L4);

  rejectWithoutMutation(
    state,
    (current) => applyAction(current, "possess"),
    "Stage 3 Possess must remain unavailable before the throne node is captured",
  );
  state = command(state, "capture");

  const unpossessed = command(state, "assault");
  assert.equal(unpossessed.stage.bossHealth, 13, "Stage 3 must allow the unpossessed four-damage assault after capture");

  state = command(state, "possess");
  state = command(state, "assault");
  assert.equal(state.stage.bossHealth, 8, "a possessed Rift Lens assault must deal nine damage from full health");
  state = command(state, "assault");
  assert.equal(state.stage.bossHealth, 0, "the second possessed Rift Lens assault must finish the remaining eight health");
  assert.equal(state.status, "reward", "two nine-damage assaults must defeat the 17-health Gate Sovereign");

  const envelope = createSaveEnvelope(state);
  assert.deepEqual(
    restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope))),
    state,
    "a completed legal Stage 3 Possess trace must round-trip through the save envelope",
  );
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
  let state = commands(start(), [...thinLine, "capture", ...S1_ENCOUNTER, "assault", "assault", "assault"]);
  state = accept(chooseReward(state, "rift-lens"));
  state = commands(state, [...thinLine, "capture", "capture", "possess", "assault", "assault"]);
  assert.equal(state.status, "reward", "the thin Stage 2 line survives on the killing blow");
  assert.equal(state.stage.integrity, 0);
  state = accept(chooseReward(state, "anchor-shard"));
  assert.equal(state.stage.integrity, 4, "Echo Throne entry = max(0 + restore 1 + Anchor Shard 2, entry floor 4)");

  state = commands(state, [...thinLine, "capture", "assault"]);
  assert.equal(state.status, "defeat", "the first undefended Echo Throne assault must be lethal");
  assert.equal(state.stage.integrity, 0);
  rejectWithoutMutation(state, (current) => applyAction(current, "assault"), "a defeated stage accepts no commands");

  const retried = accept(retryStage(state), "defeat must allow a retry");
  assert.equal(retried.status, "active");
  assert.equal(retried.stage.integrity, 4, "retry must restore the recorded stage-entry integrity");
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

test("versioned current save envelopes replay deterministically and reject tampering", () => {
  const original = finishCampaign();
  const envelope = createSaveEnvelope(original);

  assert.deepEqual(envelope, {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    trace: original.trace,
  });
  assert.deepEqual(
    restoreSaveEnvelope(JSON.parse(JSON.stringify(envelope))),
    original,
    "a current exported-version envelope must deterministically replay every legal reward route",
  );

  const wrongSchema = { ...envelope, schema: "forged-schema" };
  assert.throws(() => restoreSaveEnvelope(wrongSchema), /not an Abyssal Command save/);

  const wrongRules = { ...envelope, rulesVersion: `${RULES_VERSION}-tampered` };
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

test("pre-current save envelopes are explicitly rejected", () => {
  const priorSchemaVersion = SAVE_SCHEMA_VERSION - 1;
  assert.ok(priorSchemaVersion > 0, "The current exported schema version must have a predecessor for migration rejection coverage.");
  const priorSchemaEnvelope = {
    schema: SAVE_SCHEMA,
    schemaVersion: priorSchemaVersion,
    rulesVersion: RULES_VERSION,
    trace: [{ kind: "start" }, { kind: "action", action: "hunt" }],
  };
  assert.throws(
    () => restoreSaveEnvelope(priorSchemaEnvelope),
    /This save schema is not supported by the Stage 1 encounter rules/,
    "a prior exported schema must fail with the current schema-migration explanation, not replay under newer rules",
  );

  const priorRulesEnvelope = {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: `${RULES_VERSION}-prior`,
    trace: [{ kind: "start" }, { kind: "action", action: "hunt" }],
  };
  assert.throws(
    () => restoreSaveEnvelope(priorRulesEnvelope),
    /incompatible campaign rules/,
    "a prior exported rules version must reject rather than replaying under the current exported rules",
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

test("v5 publishes only campaign limits globally and keeps combat and rewards with their stages", () => {
  assert.deepEqual(BALANCE, { maxIntegrity: 10 });

  const [cinderSpan, veilCitadel, echoThrone] = STAGES;
  assert.deepEqual(
    cinderSpan.rewards.find(({ id }) => id === "stillwater-hourglass")?.effects,
    { cooldownMultiplier: 0.8, autoExtract: true },
    "Stage 1 must own the Hourglass cooldown reward",
  );

  assert.deepEqual(veilCitadel.commands.assault, {
    cooldown: 3,
    damage: 3,
    possessedDamage: 1,
    requiresPossessed: true,
    counter: { mode: "shielded", baseDamage: 2, shieldDivisor: 4, thinLegion: 4, thinPenalty: 1 },
  });
  assert.deepEqual(echoThrone.commands.assault, {
    cooldown: 3,
    damage: 4,
    possessedDamage: 1,
    counter: { mode: "shielded", baseDamage: 8, shieldDivisor: 4, thinLegion: 5, thinPenalty: 1 },
  });

  assert.deepEqual(
    Object.fromEntries(cinderSpan.rewards.map(({ id, effects }) => [id, effects])),
    {
      "ember-cohort": { materializeBonus: 2 },
      "rift-lens": { possessedAssaultBonus: 4 },
      "stillwater-hourglass": { cooldownMultiplier: 0.8, autoExtract: true },
      "shadebreaker-brand": { counterReduction: 2 },
    },
  );
  assert.deepEqual(
    Object.fromEntries(veilCitadel.rewards.map(({ id, effects }) => [id, effects])),
    {
      "veil-vanguard": { stageEntry: { "echo-throne": { legion: 4 } } },
      "anchor-shard": { stageEntry: { "echo-throne": { integrity: 2 } } },
      "abyssal-banner": { entryAegis: 1, materializeBonus: 1 },
    },
  );
  assert.deepEqual(
    Object.fromEntries(echoThrone.rewards.map(({ id, effects }) => [id, effects])),
    {
      "throne-echo": {},
      "dawnless-crown": {},
    },
  );
});
