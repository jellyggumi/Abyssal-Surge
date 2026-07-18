#!/usr/bin/env node
// Campaign balance simulator + exploit fuzzer for Abyssal Surge rules v5.
// Node 22, zero dependencies. It derives arithmetic from the public stage
// definitions and reward-benefit API, then exercises legal campaign transitions.
// Usage: node scripts/run-campaign-balance-sim.mjs   (prints one JSON summary)

import {
  RULES_VERSION,
  STAGES,
  createCampaign,
  startCampaign,
  applyAction,
  applyEncounterEvent,
  chooseReward,
  retryStage,
  getStageChecklist,
  getAvailableActions,
  createSaveEnvelope,
  restoreSaveEnvelope,
  getCampaignBenefits,
} from "../campaign-state.js";

const ACTIONS = [...new Set(STAGES.flatMap((stage) => Object.keys(stage.commands)))];
const ALL_REWARD_IDS = STAGES.flatMap((s) => s.rewards.map((r) => r.id));
const CASUAL_TRIALS = 200;
const FUZZ_SEQUENCES = 1000;
const FUZZ_OPS_PER_SEQ = 150;
const MAX_CAMPAIGN_STEPS = 500;
// Derived action-count arithmetic only; this simulator does not measure player
// time, fairness, or live-session behavior.

// --- deterministic PRNG (mulberry32) ---
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// --- shared helpers over public stage commands and reward benefits ---
function counterAt(stage, legion, counterReduction = 0) {
  const counter = stage.commands.assault.counter;
  if (counter.mode === "threshold") {
    const base = legion >= counter.minimumLegion ? counter.readyDamage : counter.belowDamage;
    return Math.max(1, base - counterReduction);
  }
  const shield = Math.floor(legion / counter.shieldDivisor);
  const thin = legion < counter.thinLegion ? counter.thinPenalty : 0;
  return Math.max(1, Math.max(1, counter.baseDamage - shield) + thin - counterReduction);
}
function materializedLegion(state, legion) {
  const stage = STAGES[state.stageIndex];
  const benefits = getCampaignBenefits(state);
  return Math.min(
    state.stage.capacity,
    legion + stage.progression.materializeSummon + benefits.summonBonus
  );
}
function reachableLegionTiers(state) {
  const tiers = [state.stage.legion];
  while (tiers.at(-1) < state.stage.capacity) {
    const next = materializedLegion(state, tiers.at(-1));
    if (next === tiers.at(-1)) break;
    tiers.push(next);
  }
  return tiers;
}
function counterOneTarget(state) {
  const benefits = getCampaignBenefits(state);
  const stage = STAGES[state.stageIndex];
  return reachableLegionTiers(state).find(
    (legion) => counterAt(stage, legion, benefits.counterReduction) === 1
  ) ?? null;
}
function hasPendingEncounter(state) {
  const stage = STAGES[state.stageIndex];
  return Boolean(stage.encounter && !state.stage.encounter?.bossExposed);
}
function readyForBossAssault(state) {
  const stage = STAGES[state.stageIndex];
  const assault = stage.commands.assault;
  const preparationLegion = Math.max(2, stage.encounter?.preparationLegion ?? 2);
  return state.stage.nodes >= stage.nodeGoal
    && state.stage.legion >= preparationLegion
    && (!assault.requiresPossessed || state.stage.possessed);
}
function resolveDeclaredEncounter(state) {
  const stage = STAGES[state.stageIndex];
  const events = [];
  while (hasPendingEncounter(state)) {
    const encounter = state.stage.encounter;
    const wave = stage.encounter.waves.find((configured) =>
      !encounter.waves.find((progress) => progress.id === configured.id)?.cleared
    );
    if (!wave) throw new Error(`encounter ${stage.id} has no uncleared declared wave`);
    const event = encounter.activeWaveId === wave.id
      ? { type: "wave-cleared", stageId: stage.id, waveId: wave.id }
      : { type: "start-wave", stageId: stage.id, waveId: wave.id };
    const result = applyEncounterEvent(state, event);
    if (!result.accepted) throw new Error(`declared encounter event rejected: ${event.type}/${wave.id}`);
    state = result.state;
    events.push(event);
  }
  return { state, events };
}
function wantsEconomy(state, targetLegion) {
  const s = state.stage;
  if (s.legion >= targetLegion) return null;
  const avail = getAvailableActions(state);
  if (avail.includes("materialize")) return "materialize";
  if (avail.includes("extract")) return "extract";
  if (avail.includes("hunt")) return "hunt";
  return null;
}
function checklistNext(state) {
  const avail = getAvailableActions(state);
  for (const item of getStageChecklist(state)) {
    if (!item.complete && avail.includes(item.id)) return item.id;
  }
  return avail[0];
}

// --- archetype policies: state -> chosen action (from available set) ---
function byPriority(priority) {
  return (state) => {
    const avail = getAvailableActions(state);
    for (const action of priority) if (avail.includes(action)) return action;
    return avail[0];
  };
}
const policies = {
  // (a) straight to the boss: minimum legion, never domain, never S3 possess.
  // capture outranks materialize so the legion stays at the thin minimum.
  rusher(state) {
    const avail = getAvailableActions(state);
    const stage = STAGES[state.stageIndex];
    const order = stage.number === 3
      ? ["assault", "capture", "materialize", "extract", "hunt"] // skips domain + possess
      : ["assault", "possess", "capture", "materialize", "extract", "hunt"];
    for (const action of order) if (avail.includes(action)) return action;
    return avail[0];
  },
  // (b) economy first: build to the first reachable counter-1 legion tier;
  // when no tier reaches it, build to capacity.
  "greedy-economy"(state) {
    const target = counterOneTarget(state) ?? state.stage.capacity;
    return wantsEconomy(state, target) ?? checklistNext(state);
  },
  // (c) adaptive optimal: in S1/S2 build to the first reachable counter-1
  // tier. In Echo Throne, account for every carried combat boon before adding
  // legion: possession and Rift Lens damage, Banner/Domain aegis, Bulwark
  // counter reduction, and the actual reward-adjusted materialize increment.
  optimal(state) {
    const stage = STAGES[state.stageIndex];
    const s = state.stage;
    const benefits = getCampaignBenefits(state);
    let target;
    if (stage.number < 3) {
      target = counterOneTarget(state) ?? s.capacity;
    } else {
      const assault = stage.commands.assault;
      const possessionDamage = stage.commands.possess
        ? (assault.possessedDamage ?? 0) + benefits.lensDamage
        : 0;
      const damage = assault.damage + possessionDamage;
      const assaults = Math.ceil(s.bossHealth / damage);
      const domain = stage.commands.domain;
      const availableAegis = s.aegis + (s.domainUses === 0 ? (domain?.aegis ?? 0) : 0);
      const nonKillingExposed = Math.max(0, assaults - availableAegis - 1);
      const postDomainIntegrity = s.domainUses === 0
        ? Math.min(benefits.maxIntegrity, s.integrity + (domain?.integrityRestore ?? 0))
        : s.integrity;
      target = reachableLegionTiers(state).find(
        (legion) => postDomainIntegrity - nonKillingExposed * counterAt(
          stage,
          legion,
          benefits.counterReduction
        ) > 0
      ) ?? s.capacity;
    }
    const eco = wantsEconomy(state, target);
    if (eco) return eco;
    const avail = getAvailableActions(state);
    if (stage.number === 3) {
      for (const action of ["capture", "domain", "possess", "assault"]) {
        if (avail.includes(action)) return action;
      }
    }
    return checklistNext(state);
  },
  // (d) uniform random over available actions (seeded outside)
  casual(state, rng) {
    return pick(rng, getAvailableActions(state));
  },
  // (e) comeback: burn integrity with the rusher's thin line through S1/S2,
  // then in Echo Throne pivot to capture -> domain -> possess and win off the
  // Domain's restore + aegis. Same early trajectory as rusher; the divergence
  // is exactly the domain decision.
  comeback(state, _rng, probe) {
    const stage = STAGES[state.stageIndex];
    const avail = getAvailableActions(state);
    if (stage.number === 3) {
      if (avail.includes("capture")) return "capture";
      if (avail.includes("domain")) {
        probe.integrityBeforeDomain = state.stage.integrity;
        return "domain";
      }
      if (avail.includes("possess")) return "possess";
      for (const action of ["assault", "materialize", "extract", "hunt"]) {
        if (avail.includes(action)) return action;
      }
      return avail[0];
    }
    for (const action of ["assault", "possess", "capture", "materialize", "extract", "hunt"]) {
      if (avail.includes(action)) return action;
    }
    return avail[0];
  }
};

// Reward plans deliberately cover every non-terminal doctrine; Stage 3's
// terminal archive choice has no mechanical effect.
const rewardPrefs = {
  rusher: { "cinder-span": "rift-lens", "veil-citadel": "veil-vanguard", "echo-throne": "throne-echo" },
  "greedy-economy": { "cinder-span": "ember-cohort", "veil-citadel": "abyssal-banner", "echo-throne": "dawnless-crown" },
  optimal: { "cinder-span": "stillwater-hourglass", "veil-citadel": "abyssal-banner", "echo-throne": "throne-echo" },
  comeback: { "cinder-span": "shadebreaker-brand", "veil-citadel": "anchor-shard", "echo-throne": "throne-echo" }
};

// A campaign is WON only if it completes without a single defeat.
// The first defeat ends the measured run (retry loops are a UX affordance,
// not a balance excuse).
function runCampaign(name, rng, rewardPlan) {
  let state = startCampaign(createCampaign()).state;
  const probe = { integrityBeforeDomain: null };
  const maxIntegrity = getCampaignBenefits(state).maxIntegrity;
  const perStage = STAGES.map(() => ({
    actions: 0,
    encounterEvents: 0,
    sequence: [],
    integrityEntry: null,
    integrityEnd: null,
    integrityMin: maxIntegrity
  }));
  perStage[0].integrityEntry = state.stage.integrity;
  const rewardsTaken = [];
  let steps = 0;
  let defeatedAt = null;
  while (state.status !== "campaign-complete" && steps < MAX_CAMPAIGN_STEPS) {
    steps += 1;
    if (state.status === "defeat") {
      defeatedAt = STAGES[state.stageIndex].id;
      break;
    }
    if (state.status === "reward") {
      const stage = STAGES[state.stageIndex];
      const rewardId = rewardPlan
        ? rewardPlan[stage.id] ?? pick(rng, stage.rewards.map((r) => r.id))
        : pick(rng, stage.rewards.map((r) => r.id));
      rewardsTaken.push(rewardId);
      state = chooseReward(state, rewardId).state;
      if (state.status === "active") perStage[state.stageIndex].integrityEntry = state.stage.integrity;
      continue;
    }
    const bucket = perStage[state.stageIndex];
    if (hasPendingEncounter(state) && readyForBossAssault(state)) {
      const resolved = resolveDeclaredEncounter(state);
      state = resolved.state;
      bucket.encounterEvents += resolved.events.length;
      continue;
    }
    const action = policies[name](state, rng, probe);
    const result = applyAction(state, action);
    if (!result.accepted) throw new Error(`policy ${name} chose rejected action ${action}`);
    state = result.state;
    bucket.actions += 1;
    bucket.sequence.push(action);
    bucket.integrityMin = Math.min(bucket.integrityMin, state.stage?.integrity ?? bucket.integrityMin);
    if (state.status === "reward" || state.status === "campaign-complete") {
      bucket.integrityEnd = state.stage.integrity;
    }
  }
  return {
    win: state.status === "campaign-complete",
    defeatedAt,
    totalActions: perStage.reduce((sum, s) => sum + s.actions, 0),
    perStage,
    rewardsTaken,
    sequenceSignature: perStage.map((s) => s.sequence.join(">")).join(" | "),
    integrityTrail: perStage.map((s) => s.integrityEnd),
    probe,
    benefits: getCampaignBenefits(state),
  };
}

// --- archetype measurement ---
function measureArchetypes() {
  const out = {};
  for (const name of ["rusher", "greedy-economy", "optimal", "comeback"]) {
    const run = runCampaign(name, mulberry32(1), rewardPrefs[name]);
    out[name] = {
      trials: 1,
      deterministic: true,
      winRatePct: run.win ? 100 : 0,
      defeatedAt: run.defeatedAt,
      totalActions: run.totalActions,
      perStage: run.perStage.map((s, i) => ({
        stage: STAGES[i].id,
        actions: s.actions,
        encounterEvents: s.encounterEvents,
        integrityEntry: s.integrityEntry,
        integrityEnd: s.integrityEnd,
        integrityMin: s.integrityMin
      })),
      sequenceSignature: run.sequenceSignature,
      probe: run.probe
    };
  }
  // casual: seeded random legal walker, first defeat = loss
  const casualRuns = [];
  for (let t = 0; t < CASUAL_TRIALS; t += 1) {
    casualRuns.push(runCampaign("casual", mulberry32(1000 + t), null));
  }
  const wins = casualRuns.filter((r) => r.win);
  const totals = wins.map((r) => r.totalActions);
  const defeatStages = {};
  for (const r of casualRuns) {
    if (r.defeatedAt) defeatStages[r.defeatedAt] = (defeatStages[r.defeatedAt] ?? 0) + 1;
  }
  const uniqueSeqs = new Set(casualRuns.map((r) => r.sequenceSignature));
  out.casual = {
    trials: CASUAL_TRIALS,
    deterministic: false,
    winRatePct: (wins.length / CASUAL_TRIALS) * 100,
    defeats: CASUAL_TRIALS - wins.length,
    defeatStageHistogram: defeatStages,
    totalActionsOnWins: totals.length
      ? { min: Math.min(...totals), max: Math.max(...totals), mean: totals.reduce((a, b) => a + b, 0) / totals.length }
      : null,
    uniqueSequences: uniqueSeqs.size
  };
  return out;
}

// --- every legal Stage 1 × Stage 2 reward trajectory under the adaptive policy ---
function measureCombos() {
  const [stage1, stage2, terminalStage] = STAGES;
  const terminalRewardId = terminalStage.rewards[0].id;
  const combos = [];
  for (const stage1Reward of stage1.rewards) {
    for (const stage2Reward of stage2.rewards) {
      const plan = {
        [stage1.id]: stage1Reward.id,
        [stage2.id]: stage2Reward.id,
        [terminalStage.id]: terminalRewardId
      };
      const run = runCampaign("optimal", mulberry32(7), plan);
      const carriedBenefits = run.benefits;
      combos.push({
        stage1RewardId: stage1Reward.id,
        stage2RewardId: stage2Reward.id,
        combo: `${stage1Reward.id} + ${stage2Reward.id}`,
        carriedBenefits,
        win: run.win,
        totalActions: run.totalActions,
        perStageActions: run.perStage.map((s) => s.actions),
        integrityEndPerStage: run.integrityTrail,
        completionPerAction: run.win ? 1 / run.totalActions : 0
      });
    }
  }
  const completionRates = combos.map((combo) => combo.completionPerAction).sort((a, b) => a - b);
  const middle = Math.floor(completionRates.length / 2);
  const medianCompletionPerAction = completionRates.length % 2 === 0
    ? (completionRates[middle - 1] + completionRates[middle]) / 2
    : completionRates[middle];
  const outcomeKeys = new Set(combos.map((combo) => `${combo.totalActions}:${combo.integrityEndPerStage.join(",")}`));
  return {
    stage1RewardIds: stage1.rewards.map((reward) => reward.id),
    stage2RewardIds: stage2.rewards.map((reward) => reward.id),
    expectedPairCount: stage1.rewards.length * stage2.rewards.length,
    measuredPairCount: combos.length,
    completeCoverage: combos.length === stage1.rewards.length * stage2.rewards.length,
    combos,
    medianCompletionPerAction,
    maxCompletionPerActionRatio: medianCompletionPerAction > 0
      ? Math.max(...completionRates) / medianCompletionPerAction
      : null,
    distinctOutcomes: outcomeKeys.size,
    identicalOutcomes: outcomeKeys.size === 1
  };
}

// --- targeted command and encounter-resolution probes ---
function contractProbes() {
  const play = (seqStages, rewards) => {
    let state = startCampaign(createCampaign()).state;
    const applied = [];
    const encounterEvents = [];
    // Probe sequences may cover a prefix of the campaign (the chain now runs
    // ten stages); reaching the end of the provided lines is a valid stop.
    for (let i = 0; i < Math.min(STAGES.length, seqStages.length); i += 1) {
      for (const action of seqStages[i]) {
        if (action === "assault" && hasPendingEncounter(state)) {
          const resolved = resolveDeclaredEncounter(state);
          state = resolved.state;
          encounterEvents.push(...resolved.events);
        }
        const result = applyAction(state, action);
        if (!result.accepted) return { status: "rejected", at: `${STAGES[i].id}:${action}`, applied, encounterEvents };
        state = result.state;
        applied.push(action);
        if (state.status === "defeat") {
          return { status: "defeat", stage: STAGES[state.stageIndex].id, integrity: state.stage.integrity, applied, encounterEvents };
        }
      }
      if (state.status === "reward") state = chooseReward(state, rewards[i]).state;
    }
    return { status: state.status, stage: STAGES[state.stageIndex].id, applied, encounterEvents };
  };
  const thinLine = ["hunt", "hunt", "extract", "materialize"];
  const stageOnePreparedLine = [...thinLine, "materialize"];
  const s1 = [...stageOnePreparedLine, "capture", "assault", "assault", "assault"];
  const s2 = [...thinLine, "capture", "capture", "possess", "assault", "assault"];
  const rusherS3 = [...thinLine, "capture", "assault"];
  const comebackS3 = [...thinLine, "capture", "domain", "possess", "assault", "assault"];
  const rewards = ["rift-lens", "anchor-shard", "throne-echo"];
  const rusherDefeat = play([s1, s2, rusherS3], rewards);
  const comebackWin = play([s1, s2, comebackS3], rewards);
  return {
    rusherDefeatSequence: {
      description: "thin-legion rush without invoking the configured Echo Throne Domain; the first Echo Throne assault is lethal",
      rewards,
      perStage: [s1, s2, rusherS3],
      result: rusherDefeat
    },
    comebackDomainFlip: {
      description: "identical S1/S2 line; Echo Throne invokes its configured Domain before the possession assaults",
      rewards,
      perStage: [s1, s2, comebackS3],
      result: comebackWin
    },
    domainConvertsDefeatToWin: rusherDefeat.status === "defeat" && rusherDefeat.stage === "echo-throne" &&
      comebackWin.status !== "defeat" && comebackWin.stage !== "echo-throne"
  };
}

// --- exploit fuzzer ---
function stageInvariantErrors(state) {
  const errs = [];
  const stage = STAGES[state.stageIndex];
  const s = state.stage;
  const benefits = getCampaignBenefits(state);
  const maximumAegis = benefits.initialAegis + (s.domainUses * (stage.commands.domain?.aegis ?? 0));
  if (!(s.integrity >= 0 && s.integrity <= benefits.maxIntegrity)) errs.push(`integrity out of [0,${benefits.maxIntegrity}]: ${s.integrity}`);
  if (!(s.entryIntegrity >= 0 && s.entryIntegrity <= benefits.maxIntegrity)) errs.push(`entryIntegrity out of range: ${s.entryIntegrity}`);
  if (!(s.souls >= 0)) errs.push(`souls negative: ${s.souls}`);
  if (!(s.legion >= 0 && s.legion <= s.capacity)) errs.push(`legion out of [0,capacity]: ${s.legion}/${s.capacity}`);
  if (!(Number.isInteger(s.capacity) && s.capacity >= s.legion)) errs.push(`capacity is invalid for legion ${s.legion}: ${s.capacity}`);
  if (!(s.bossHealth >= 0 && s.bossHealth <= stage.bossHealth)) errs.push(`bossHealth out of bounds: ${s.bossHealth}`);
  if (!(s.hunted >= 0 && s.hunted <= stage.progression.huntGoal)) errs.push(`hunted out of [0,${stage.progression.huntGoal}]: ${s.hunted}`);
  if (!(s.aegis >= 0 && s.aegis <= maximumAegis)) errs.push(`aegis out of [0,${maximumAegis}]: ${s.aegis}`);
  if (!(s.nodes >= 0 && s.nodes <= stage.nodeGoal)) errs.push(`nodes exceed goal: ${s.nodes}/${stage.nodeGoal}`);
  if (s.integrity === 0 && state.status === "active") errs.push("integrity 0 while status active (integrity-0 bypass)");
  const stageIds = state.rewards.map((r) => r.stageId);
  if (new Set(stageIds).size !== stageIds.length) errs.push("duplicate reward for a stage");
  if (state.rewards.length > state.stageIndex + 1) errs.push("more rewards than stages entered (stage skip / reward dup)");
  return errs;
}

function semanticEqual(a, b) {
  return JSON.stringify({ i: a.stageIndex, st: a.status, r: a.rewards, sg: a.stage }) ===
    JSON.stringify({ i: b.stageIndex, st: b.status, r: b.rewards, sg: b.stage });
}
function fuzzEncounterEvent(state, rng) {
  const stage = STAGES[state.stageIndex];
  const encounter = state.stage.encounter;
  const nextWave = stage.encounter?.waves.find((wave) =>
    !encounter?.waves.find((progress) => progress.id === wave.id)?.cleared
  );
  const event = nextWave && encounter?.activeWaveId === nextWave.id
    ? { type: pick(rng, ["wave-cleared", "breach"]), stageId: stage.id, waveId: nextWave.id }
    : { type: "start-wave", stageId: stage.id, waveId: nextWave?.id ?? "forged-wave" };
  if (rng() < 0.15) event.waveId = "forged-wave";
  if (rng() < 0.1) event.stageId = "forged-stage";
  return event;
}

function fuzz() {
  const findings = [];
  let opsTotal = 0;
  let acceptedTotal = 0;
  let roundTrips = 0;
  let defeatsSeen = 0;
  const record = (kind, seed, opIndex, detail, replay) => {
    findings.push({ kind, seed, opIndex, detail, replay });
  };
  for (let seed = 0; seed < FUZZ_SEQUENCES; seed += 1) {
    const rng = mulberry32(90000 + seed);
    let state = createCampaign();
    const replayLog = [];
    let prevStageIndex = 0;
    for (let op = 0; op < FUZZ_OPS_PER_SEQ; op += 1) {
      opsTotal += 1;
      const roll = rng();
      let result;
      let opDesc;
      try {
        if (roll < 0.56) {
          const action = pick(rng, ACTIONS);
          opDesc = `applyAction(${action})`;
          result = applyAction(state, action);
        } else if (roll < 0.68) {
          const event = fuzzEncounterEvent(state, rng);
          opDesc = `applyEncounterEvent(${event.type}/${event.stageId}/${event.waveId})`;
          result = applyEncounterEvent(state, event);
        } else if (roll < 0.78) {
          const rewardId = rng() < 0.85 ? pick(rng, ALL_REWARD_IDS) : "forged-crown-of-nothing";
          opDesc = `chooseReward(${rewardId})`;
          result = chooseReward(state, rewardId);
        } else if (roll < 0.88) {
          opDesc = "retryStage()";
          result = retryStage(state);
        } else if (roll < 0.96) {
          opDesc = "startCampaign()";
          result = startCampaign(state);
        } else {
          opDesc = "save/restore roundtrip";
          const restored = restoreSaveEnvelope(createSaveEnvelope(state));
          roundTrips += 1;
          if (!semanticEqual(state, restored)) {
            record("save-restore-divergence", seed, op, "restored state differs semantically", replayLog.slice());
          }
          continue;
        }
      } catch (error) {
        record("engine-throw", seed, op, `${opDesc} threw: ${error.message}`, replayLog.slice());
        break;
      }
      replayLog.push(opDesc);
      if (replayLog.length > 40) replayLog.shift();
      if (result.accepted) {
        acceptedTotal += 1;
        const next = result.state;
        if (next.status === "defeat") defeatsSeen += 1;
        // stage skip: stageIndex may only step by +1 and only via reward
        if (next.stageIndex > prevStageIndex + 1) {
          record("stage-skip", seed, op, `stageIndex ${prevStageIndex} -> ${next.stageIndex}`, replayLog.slice());
        }
        prevStageIndex = Math.max(prevStageIndex, next.stageIndex);
        for (const err of stageInvariantErrors(next)) {
          record("bound-violation", seed, op, `${opDesc}: ${err}`, replayLog.slice());
        }
        state = next;
      }
      // liveness: from any non-complete state some operation must be accepted
      if (state.status !== "campaign-complete") {
        const live = getAvailableActions(state).length > 0 ||
          STAGES[state.stageIndex].rewards.some((r) => chooseReward(state, r.id).accepted) ||
          retryStage(state).accepted ||
          startCampaign(state).accepted;
        if (!live) record("stall", seed, op, `no accepted operation from status=${state.status}`, replayLog.slice());
      }
    }
  }
  // Targeted probe: an oversized current-schema trace envelope must be rejected.
  let oversizeRejected = false;
  try {
    restoreSaveEnvelope({
      schema: "abyssal-surge-campaign",
      schemaVersion: 4,
      rulesVersion: RULES_VERSION,
      trace: Array.from({ length: 401 }, () => ({ kind: "action", action: "hunt" }))
    });
  } catch {
    oversizeRejected = true;
  }
  // Targeted probe: the preceding v4-rules/schema-v3 envelope must be rejected.
  let legacyEnvelopeRejection = null;
  try {
    restoreSaveEnvelope({
      schema: "abyssal-surge-campaign",
      schemaVersion: 3,
      rulesVersion: "abyssal-surge-rules-v4",
      trace: [{ kind: "start" }]
    });
  } catch (error) {
    legacyEnvelopeRejection = error.message;
  }
  return {
    sequences: FUZZ_SEQUENCES,
    opsPerSequence: FUZZ_OPS_PER_SEQ,
    opsTotal,
    acceptedTotal,
    defeatsReachedByFuzzer: defeatsSeen,
    saveRestoreRoundTrips: roundTrips,
    oversizeTraceRejected: oversizeRejected,
    legacyEnvelopeRejection,
    findings
  };
}

// --- branch census over real runs: fraction of decision states with >1 option ---
function branchCensus() {
  const observe = (name, rng, plan) => {
    let state = startCampaign(createCampaign()).state;
    let decisions = 0;
    let branchPoints = 0;
    let steps = 0;
    const probe = { integrityBeforeDomain: null };
    while (state.status !== "campaign-complete" && state.status !== "defeat" && steps < MAX_CAMPAIGN_STEPS) {
      steps += 1;
      if (state.status === "reward") {
        state = chooseReward(state, plan ? plan[STAGES[state.stageIndex].id] : STAGES[state.stageIndex].rewards[0].id).state;
        continue;
      }
      const avail = getAvailableActions(state);
      if (hasPendingEncounter(state) && readyForBossAssault(state)) {
        state = resolveDeclaredEncounter(state).state;
        continue;
      }
      decisions += 1;
      if (avail.length > 1) branchPoints += 1;
      const result = applyAction(state, policies[name](state, rng, probe));
      if (!result.accepted) throw new Error(`branch census policy ${name} chose a rejected action`);
      state = result.state;
    }
    return { policy: name, decisions, branchPoints, branchFraction: decisions ? branchPoints / decisions : 0 };
  };
  const rows = [
    observe("optimal", mulberry32(11), rewardPrefs.optimal),
    observe("greedy-economy", mulberry32(11), rewardPrefs["greedy-economy"]),
    observe("rusher", mulberry32(11), rewardPrefs.rusher),
    observe("comeback", mulberry32(11), rewardPrefs.comeback),
    observe("casual", mulberry32(4242), null)
  ];
  return rows;
}

// --- determinism check: every generated summary component runs twice ---
function measureSummaryComponents() {
  const archetypes = measureArchetypes();
  const rewardCombos = measureCombos();
  const probes = contractProbes();
  const fuzzReport = fuzz();
  const branches = branchCensus();
  const deterministicSignatures = new Set(
    ["rusher", "greedy-economy", "optimal", "comeback"].map((name) => archetypes[name].sequenceSignature)
  );
  const outcomeVariety = new Set(
    ["rusher", "greedy-economy", "optimal", "comeback"].map((name) => {
      const archetype = archetypes[name];
      return `${archetype.winRatePct}:${archetype.totalActions}:${archetype.perStage.map((stage) => stage.integrityEnd).join(",")}`;
    })
  );
  return {
    archetypes,
    rewardCombos,
    contractProbes: probes,
    fuzz: {
      ...fuzzReport,
      findings: fuzzReport.findings.slice(0, 20),
      findingsTotal: fuzzReport.findings.length
    },
    diversity: {
      branchCensus: branches,
      uniqueDeterministicSequences: deterministicSignatures.size,
      distinctDeterministicOutcomes: outcomeVariety.size
    },
    g7Proxy: {
      source: "derived command and declared-encounter event counts; no player-time or fairness measurement",
      perStage: STAGES.map((stage, index) => {
        const run = archetypes.optimal.perStage[index];
        return {
          stage: stage.id,
          commandActions: run.actions,
          encounterEvents: run.encounterEvents,
          rewardChoicesPerCompletedCampaign: 1
        };
      })
    }
  };
}
function determinismCheck() {
  const snapshot = () => JSON.stringify(measureSummaryComponents());
  return snapshot() === snapshot();
}

// --- assemble ---
const components = measureSummaryComponents();
const deterministic = determinismCheck();
const summary = {
  simulator: "run-campaign-balance-sim.mjs",
  rulesVersion: RULES_VERSION,
  campaignMaxIntegrity: getCampaignBenefits(createCampaign()).maxIntegrity,
  stageRuleIds: STAGES.map((stage) => stage.id),
  ...components,
  determinismDoubleRunIdentical: deterministic
};

process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
