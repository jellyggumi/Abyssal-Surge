export const RULES_VERSION = "abyssal-surge-rules-v2";
export const SAVE_SCHEMA = "abyssal-surge-campaign";
export const SAVE_SCHEMA_VERSION = 2;

// Balance v2 knobs. Every number the G2 band tuning may touch lives here.
// See _workspace/20260716-shadow-lord-rts-rpg/design/balance-sheet.md for the
// decision table and the iteration log that produced these values.
export const BALANCE = Object.freeze({
  counterBase: Object.freeze([1, 2, 8]), // boss counterblow per stage (1-indexed by stage.number)
  shieldDivisor: 4,                       // counter reduction = floor(legion / divisor)
  thinMargin: 2,                          // legion < thinMargin + stage.number => reckless assault
  thinPenalty: 1,                         // extra counter damage for reckless assaults
  rewardRestore: 1,                       // integrity restored when a stage reward is chosen
  domainRestore: 4,                       // integrity restored by Lord's Domain
  domainAegis: 2,                         // counterblows negated after Lord's Domain
  soulsPerExtract: 4,                     // souls granted per extraction cycle
  materializeCost: 2,                     // souls consumed per materialize
  materializeSummon: 2,                   // shades summoned per materialize
  vanguardLegion: 4,                      // veil-vanguard: shades already raised entering Echo Throne
  anchorRestore: 2,                       // anchor-shard: integrity restored entering Echo Throne
  assaultBase: Object.freeze([3, 3, 4]),  // player assault damage per stage
  possessDamage: 1,                       // extra assault damage while a sentinel is possessed
  lensDamage: 1,                          // rift-lens: extra damage on possession strikes
  maxIntegrity: 10
});

const MIN_SLOTS = 10;
const MAX_SLOTS = 100;
const TERMINAL_STATUSES = new Set(["reward", "campaign-complete", "defeat"]);
const MAX_TRACE_EVENTS = 400;

export const STAGES = Object.freeze([
  Object.freeze({
    id: "cinder-span",
    number: 1,
    title: "Cinder Span",
    region: "The ember bridge above the drowned forge",
    objective: "Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, then break the Cinder Warden.",
    nodeGoal: 1,
    bossName: "Cinder Warden",
    bossHealth: 8,
    rewards: Object.freeze([
      Object.freeze({ id: "ember-cohort", name: "Ember Cohort", description: "+12 legion slots for the remaining campaign." }),
      Object.freeze({ id: "rift-lens", name: "Rift Lens", description: "Possession strikes deal +1 damage from Veil Citadel onward." })
    ])
  }),
  Object.freeze({
    id: "veil-citadel",
    number: 2,
    title: "Veil Citadel",
    region: "A fortress of listening stone",
    objective: "Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil.",
    nodeGoal: 2,
    bossName: "Veil Tactician",
    bossHealth: 10,
    rewards: Object.freeze([
      Object.freeze({ id: "veil-vanguard", name: "Veil Vanguard", description: "Begin Echo Throne with a four-shade vanguard already raised." }),
      Object.freeze({ id: "anchor-shard", name: "Anchor Shard", description: "Enter Echo Throne with 2 integrity restored." })
    ])
  }),
  Object.freeze({
    id: "echo-throne",
    number: 3,
    title: "Echo Throne",
    region: "The gate above the last remembered sea",
    objective: "Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign.",
    nodeGoal: 1,
    bossName: "Gate Sovereign",
    bossHealth: 17,
    rewards: Object.freeze([
      Object.freeze({ id: "throne-echo", name: "Throne Echo", description: "Records the legion's final oath in the campaign archive." }),
      Object.freeze({ id: "dawnless-crown", name: "Dawnless Crown", description: "Records a crown forged from the closed gate." })
    ])
  })
]);

const ACTIONS = Object.freeze(["hunt", "extract", "materialize", "capture", "possess", "domain", "assault"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function stageBenefits(rewards) {
  const ids = new Set(rewards.map((reward) => reward.rewardId));
  return Object.freeze({
    capacityBonus: ids.has("ember-cohort") ? 12 : 0,
    lensDamage: ids.has("rift-lens") ? BALANCE.lensDamage : 0,
    vanguardLegion: ids.has("veil-vanguard") ? BALANCE.vanguardLegion : 0,
    anchorRestore: ids.has("anchor-shard") ? BALANCE.anchorRestore : 0
  });
}

function makeStageState(stage, rewards, entryIntegrity) {
  const benefits = stageBenefits(rewards);
  const capacity = clamp(MIN_SLOTS + benefits.capacityBonus, MIN_SLOTS, MAX_SLOTS);
  const legion = stage.number === 3 ? Math.min(benefits.vanguardLegion, capacity) : 0;
  const integrity = clamp(entryIntegrity, 0, BALANCE.maxIntegrity);
  return {
    hunted: 0,
    extracted: false,
    souls: 0,
    legion,
    capacity,
    nodes: 0,
    possessed: false,
    domainUses: 0,
    aegis: 0,
    integrity,
    entryIntegrity: integrity,
    bossHealth: stage.bossHealth
  };
}

function makeCampaign() {
  return {
    rulesVersion: RULES_VERSION,
    stageIndex: 0,
    status: "briefing",
    rewards: [],
    stage: makeStageState(STAGES[0], [], BALANCE.maxIntegrity),
    trace: [],
    revision: 0,
    lastMessage: "The abyss answers when you are ready."
  };
}

function transition(state, mutate, event) {
  const next = clone(state);
  mutate(next);
  if (event) next.trace.push(event);
  next.revision += 1;
  return next;
}

function accepted(state, message, effect) {
  return { accepted: true, state, message, effect };
}

function rejected(state, message) {
  return { accepted: false, state, message, effect: "none" };
}

function activeStage(state) {
  return STAGES[state.stageIndex];
}

function assertStateShape(state) {
  assert(state && typeof state === "object", "Campaign state must be an object.");
  assert(state.rulesVersion === RULES_VERSION, "Campaign rules version is incompatible.");
  assert(Number.isInteger(state.stageIndex) && state.stageIndex >= 0 && state.stageIndex < STAGES.length, "Campaign stage index is invalid.");
  assert(typeof state.status === "string", "Campaign status is invalid.");
  assert(Array.isArray(state.rewards) && Array.isArray(state.trace), "Campaign history is invalid.");
}

function canAct(state) {
  return state.status === "active";
}

function stageComplete(next, stage) {
  next.status = "reward";
  next.lastMessage = `${stage.bossName} dissolves into ash. Choose one lasting boon.`;
}

function isThin(legion, stage) {
  return legion < BALANCE.thinMargin + stage.number;
}

function counterDamage(stageState, stage) {
  const shield = Math.floor(stageState.legion / BALANCE.shieldDivisor);
  const base = BALANCE.counterBase[stage.number - 1];
  const thin = isThin(stageState.legion, stage) ? BALANCE.thinPenalty : 0;
  return Math.max(1, base - shield) + thin;
}

function assaultDamage(stageState, stage, benefits) {
  let damage = BALANCE.assaultBase[stage.number - 1];
  if (stageState.possessed) damage += BALANCE.possessDamage + benefits.lensDamage;
  return damage;
}

function guardAction(state, action) {
  assertStateShape(state);
  if (!ACTIONS.includes(action)) return rejected(state, "That command has no place in this campaign.");
  if (!canAct(state)) return rejected(state, "This stage is not accepting commands right now.");
  return null;
}

export function createCampaign() {
  return makeCampaign();
}

export function startCampaign(state = createCampaign()) {
  assertStateShape(state);
  if (state.status !== "briefing") return rejected(state, "The campaign is already underway.");
  const next = transition(state, (draft) => {
    draft.status = "active";
    draft.lastMessage = "Cinder Span opens. Follow the spoor before the bridge cools.";
  }, { kind: "start" });
  return accepted(next, next.lastMessage, "awaken");
}

export function applyAction(state, action) {
  const blocked = guardAction(state, action);
  if (blocked) return blocked;

  const stage = activeStage(state);
  const current = state.stage;
  let message = "";
  let effect = action;

  if (action === "hunt") {
    if (current.hunted >= 2) return rejected(state, "The spoor is fully mapped. Extract the gathered shade.");
    message = current.hunted === 0 ? "You find a heatless footprint in the cinders." : "The second trace exposes the rift's pulse.";
  }
  if (action === "extract" && current.hunted < 2) {
    return rejected(state, "Two spoor marks are required before extraction.");
  }
  if (action === "materialize" && (current.souls < BALANCE.materializeCost || current.legion >= current.capacity)) {
    return rejected(state, current.souls < BALANCE.materializeCost ? "Extract enough shade before materializing a legion." : "Your legion slots are full.");
  }
  if (action === "capture" && (current.legion < 2 || current.nodes >= stage.nodeGoal)) {
    return rejected(state, current.legion < 2 ? "A legion of at least two shades must anchor the node." : "Every required node is already held.");
  }
  if (action === "possess" && (stage.number < 2 || current.nodes < 1 || current.possessed)) {
    return rejected(state, stage.number < 2 ? "Possession awakens in Veil Citadel." : current.possessed ? "A sentinel is already possessed." : "Hold a signal node before taking a sentinel.");
  }
  if (action === "domain" && (stage.number !== 3 || current.nodes < 1 || current.domainUses >= 1)) {
    return rejected(state, stage.number !== 3 ? "Lord's Domain is sealed until Echo Throne." : current.domainUses >= 1 ? "Lord's Domain may answer only once." : "Secure the throne node before opening the Domain.");
  }
  if (action === "assault") {
    const needsPossession = stage.number === 2 && !current.possessed;
    if (current.nodes < stage.nodeGoal || needsPossession) {
      if (needsPossession) return rejected(state, "Possess a sentinel before confronting the Veil Tactician.");
      return rejected(state, "Hold every required node before the boss can be assaulted.");
    }
  }

  const next = transition(state, (draft) => {
    const target = draft.stage;
    if (action === "hunt") {
      target.hunted += 1;
      draft.lastMessage = message;
    }
    if (action === "extract") {
      target.extracted = true;
      target.hunted = 0;
      target.souls += BALANCE.soulsPerExtract;
      draft.lastMessage = "Four volatile shades tear free from the rift.";
    }
    if (action === "materialize") {
      const summoned = Math.min(BALANCE.materializeSummon, target.capacity - target.legion);
      target.souls -= BALANCE.materializeCost;
      target.legion += summoned;
      draft.lastMessage = `${summoned} shadow ${summoned === 1 ? "answers" : "answer"} your call.`;
    }
    if (action === "capture") {
      target.nodes += 1;
      draft.lastMessage = `${stage.number === 2 ? "A signal" : "The"} node bends beneath the legion's banner (${target.nodes}/${stage.nodeGoal}).`;
    }
    if (action === "possess") {
      target.possessed = true;
      draft.lastMessage = "A sentinel's will is folded into your command; its fury rides your assaults.";
    }
    if (action === "domain") {
      target.domainUses = 1;
      target.integrity = clamp(target.integrity + BALANCE.domainRestore, 0, BALANCE.maxIntegrity);
      target.aegis = BALANCE.domainAegis;
      draft.lastMessage = "Lord's Domain unfolds once: the abyss restores 4 integrity, and the next 2 counterblows break against it.";
    }
    if (action === "assault") {
      const benefits = stageBenefits(draft.rewards);
      const damage = assaultDamage(target, stage, benefits);
      target.bossHealth = Math.max(0, target.bossHealth - damage);
      let counter = 0;
      if (target.aegis > 0) {
        target.aegis -= 1;
      } else {
        counter = counterDamage(target, stage);
        target.integrity = Math.max(0, target.integrity - counter);
      }
      if (target.bossHealth === 0) {
        stageComplete(draft, stage);
      } else if (target.integrity === 0) {
        draft.status = "defeat";
        draft.lastMessage = "The legion loses its anchor. Regroup and retry this stage.";
      } else {
        const aftermath = counter === 0 ? "The Domain turns the counterblow aside." : `The counterblow tears ${counter} integrity.`;
        draft.lastMessage = `${stage.bossName} recoils; ${target.bossHealth} ward strength remains. ${aftermath}`;
      }
    }
  }, { kind: "action", action });

  return accepted(next, next.lastMessage, effect);
}

export function chooseReward(state, rewardId) {
  assertStateShape(state);
  if (state.status !== "reward") return rejected(state, "A reward can only be chosen after a stage victory.");
  const stage = activeStage(state);
  const reward = stage.rewards.find((item) => item.id === rewardId);
  if (!reward) return rejected(state, "That reward was not offered by this stage.");

  const next = transition(state, (draft) => {
    draft.rewards.push({ stageId: stage.id, rewardId: reward.id, rewardName: reward.name });
    if (draft.stageIndex === STAGES.length - 1) {
      draft.status = "campaign-complete";
      draft.lastMessage = `${reward.name} is claimed. The Gate Sovereign is gone, and Abyssal Command endures.`;

      return;
    }
    const benefits = stageBenefits(draft.rewards);
    const nextStage = STAGES[draft.stageIndex + 1];
    const anchorRestore = nextStage.number === 3 ? benefits.anchorRestore : 0;
    const carried = clamp(draft.stage.integrity + BALANCE.rewardRestore + anchorRestore, 0, BALANCE.maxIntegrity);
    draft.stageIndex += 1;
    draft.status = "active";
    draft.stage = makeStageState(nextStage, draft.rewards, carried);
    draft.lastMessage = `${reward.name} carries into ${activeStage(draft).title}.`;
  }, { kind: "reward", rewardId });
  return accepted(next, next.lastMessage, "reward");
}

export function retryStage(state) {
  assertStateShape(state);
  if (state.status === "briefing" || state.status === "campaign-complete" || state.status === "reward") {
    return rejected(state, "There is no active stage to retry.");
  }
  const next = clone(state);
  let checkpoint = 0;
  for (let index = 0; index < next.trace.length; index += 1) {
    const event = next.trace[index];
    if (event.kind === "start" || event.kind === "reward") checkpoint = index;
  }
  next.trace.splice(checkpoint + 1);
  next.stage = makeStageState(activeStage(next), next.rewards, next.stage.entryIntegrity);
  next.status = "active";
  next.lastMessage = `${activeStage(next).title} reforms. Your earned boons remain.`;
  next.revision += 1;
  return accepted(next, next.lastMessage, "retry");
}

export function getStageChecklist(state) {
  assertStateShape(state);
  const stage = activeStage(state);
  const current = state.stage;
  const checklist = [
    { id: "hunt", label: "Hunt two rift spoor", complete: current.hunted >= 2 || current.extracted },
    { id: "extract", label: "Extract a soul cache", complete: current.extracted },
    { id: "materialize", label: "Materialize a shadow legion", complete: current.legion >= 2 },
    { id: "capture", label: `Hold ${stage.nodeGoal} tech ${stage.nodeGoal === 1 ? "node" : "nodes"}`, complete: current.nodes >= stage.nodeGoal }
  ];
  if (stage.number === 2) checklist.push({ id: "possess", label: "Possess a sentinel", complete: current.possessed });
  if (stage.number === 3) checklist.push({ id: "domain", label: "Invoke Lord's Domain once", complete: current.domainUses === 1 });
  checklist.push({ id: "assault", label: `Defeat the ${stage.bossName}`, complete: current.bossHealth === 0 });
  return checklist;
}

export function getAvailableActions(state) {
  return ACTIONS.filter((action) => applyAction(state, action).accepted);
}

export function createSaveEnvelope(state) {
  assertStateShape(state);
  return {
    schema: SAVE_SCHEMA,
    schemaVersion: SAVE_SCHEMA_VERSION,
    rulesVersion: RULES_VERSION,
    trace: clone(state.trace)
  };
}

export function restoreSaveEnvelope(envelope) {
  assert(envelope && typeof envelope === "object", "Save envelope must be an object.");
  assert(envelope.schema === SAVE_SCHEMA, "This file is not an Abyssal Surge save.");
  assert(envelope.schemaVersion !== 1, "This save was written under the v1 balance rules and cannot continue in v2. Begin a new campaign.");
  assert(envelope.schemaVersion === SAVE_SCHEMA_VERSION, "This save schema is not supported.");
  assert(envelope.rulesVersion === RULES_VERSION, "This save uses incompatible campaign rules.");
  assert(Array.isArray(envelope.trace), "Save trace is missing.");
  assert(envelope.trace.length <= MAX_TRACE_EVENTS, `Save trace exceeds ${MAX_TRACE_EVENTS} events.`);

  let state = createCampaign();
  for (const event of envelope.trace) {
    assert(event && typeof event === "object" && typeof event.kind === "string", "Save trace contains an invalid event.");
    let result;
    if (event.kind === "start") result = startCampaign(state);
    else if (event.kind === "action") result = applyAction(state, event.action);
    else if (event.kind === "reward") result = chooseReward(state, event.rewardId);
    else if (event.kind === "retry") result = retryStage(state);
    else throw new Error("Save trace contains an unsupported event.");
    assert(result.accepted, "Save trace contains an impossible transition.");
    state = result.state;
  }
  return state;
}
