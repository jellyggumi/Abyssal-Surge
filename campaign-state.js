export const RULES_VERSION = "abyssal-surge-rules-v1";
export const SAVE_SCHEMA = "abyssal-surge-campaign";
export const SAVE_SCHEMA_VERSION = 1;

const MIN_SLOTS = 10;
const MAX_SLOTS = 100;
const TERMINAL_STATUSES = new Set(["reward", "campaign-complete", "defeat"]);
const MAX_TRACE_EVENTS = 200;

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
    bossHealth: 9,
    rewards: Object.freeze([
      Object.freeze({ id: "veil-vanguard", name: "Veil Vanguard", description: "Materialize one additional shade in Echo Throne." }),
      Object.freeze({ id: "anchor-shard", name: "Anchor Shard", description: "+16 legion slots in Echo Throne." })
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
    bossHealth: 12,
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
    capacityBonus: (ids.has("ember-cohort") ? 12 : 0) + (ids.has("anchor-shard") ? 16 : 0),
    possessionDamage: ids.has("rift-lens") ? 1 : 0,
    materializeBonus: ids.has("veil-vanguard") ? 1 : 0
  });
}

function makeStageState(stage, rewards) {
  const benefits = stageBenefits(rewards);
  const capacity = clamp(MIN_SLOTS + benefits.capacityBonus, MIN_SLOTS, MAX_SLOTS);
  return {
    hunted: 0,
    extracted: false,
    souls: 0,
    legion: 0,
    capacity,
    nodes: 0,
    possessed: false,
    domainUses: 0,
    domainActive: false,
    integrity: 10,
    bossHealth: stage.bossHealth
  };
}

function makeCampaign() {
  return {
    rulesVersion: RULES_VERSION,
    stageIndex: 0,
    status: "briefing",
    rewards: [],
    stage: makeStageState(STAGES[0], []),
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
  if (action === "extract" && (current.hunted < 2 || current.extracted)) {
    return rejected(state, current.extracted ? "The rift has already yielded its shade." : "Two spoor marks are required before extraction.");
  }
  if (action === "materialize" && (current.souls < 2 || current.legion >= current.capacity)) {
    return rejected(state, current.souls < 2 ? "Extract enough shade before materializing a legion." : "Your legion slots are full.");
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
    const needsDomain = stage.number === 3 && !current.domainActive;
    if (current.nodes < stage.nodeGoal || needsPossession || needsDomain) {
      if (needsPossession) return rejected(state, "Possess a sentinel before confronting the Veil Tactician.");
      if (needsDomain) return rejected(state, "Invoke Lord's Domain before the Gate Sovereign can be harmed.");
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
      target.souls += 3;
      draft.lastMessage = "Three volatile shades tear free from the rift.";
    }
    if (action === "materialize") {
      const extra = stage.number === 3 ? stageBenefits(draft.rewards).materializeBonus : 0;
      const summoned = Math.min(2 + extra, target.capacity - target.legion);
      target.souls -= 2;
      target.legion += summoned;
      draft.lastMessage = `${summoned} shadow ${summoned === 1 ? "answers" : "answer"} your call.`;
    }
    if (action === "capture") {
      target.nodes += 1;
      draft.lastMessage = `${stage.number === 2 ? "A signal" : "The"} node bends beneath the legion's banner (${target.nodes}/${stage.nodeGoal}).`;
    }
    if (action === "possess") {
      target.possessed = true;
      draft.lastMessage = "A sentinel's will is folded into your command.";
    }
    if (action === "domain") {
      target.domainUses = 1;
      target.domainActive = true;
      target.integrity = clamp(target.integrity + 4, 0, 10);
      draft.lastMessage = "Lord's Domain unfolds once: the abyss restores what the gate had taken.";
    }
    if (action === "assault") {
      const benefits = stageBenefits(draft.rewards);
      const damage = stage.number === 1 ? 3 : stage.number === 2 ? 3 + benefits.possessionDamage : 4 + benefits.possessionDamage;
      target.bossHealth = Math.max(0, target.bossHealth - damage);
      target.integrity = Math.max(0, target.integrity - 1);
      if (target.bossHealth === 0) {
        stageComplete(draft, stage);
      } else if (target.integrity === 0) {
        draft.status = "defeat";
        draft.lastMessage = "The legion loses its anchor. Regroup and retry this stage.";
      } else {
        draft.lastMessage = `${stage.bossName} recoils; ${target.bossHealth} ward strength remains.`;
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
      draft.lastMessage = `${reward.name} is claimed. The Gate Sovereign is gone, and the Abyssal Surge endures.`;
      return;
    }
    draft.stageIndex += 1;
    draft.status = "active";
    draft.stage = makeStageState(activeStage(draft), draft.rewards);
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
  next.stage = makeStageState(activeStage(next), next.rewards);
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
    { id: "hunt", label: "Hunt two rift spoor", complete: current.hunted >= 2 },
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
