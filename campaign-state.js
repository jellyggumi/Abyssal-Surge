export const RULES_VERSION = "abyssal-surge-rules-v5";
export const SAVE_SCHEMA = "abyssal-surge-campaign";
export const SAVE_SCHEMA_VERSION = 4;

// Campaign-wide limits only. Encounter, command, boss, and reward rules live
// with the stage that owns them.
export const BALANCE = Object.freeze({
  maxIntegrity: 10
});

const MIN_SLOTS = 10;
const MAX_SLOTS = 100;
const TERMINAL_STATUSES = new Set(["reward", "campaign-complete", "defeat"]);
const MAX_TRACE_EVENTS = 400;

const STANDARD_PROGRESSION = Object.freeze({
  huntGoal: 2,
  soulsPerExtract: 4,
  materializeCost: 2,
  materializeSummon: 2
});

const STANDARD_COMMAND_COOLDOWNS = Object.freeze({
  hunt: 4,
  extract: 5,
  materialize: 5,
  capture: 6,
  assault: 3
});

export const STAGES = Object.freeze([
  Object.freeze({
    id: "cinder-span",
    number: 1,
    nextStageId: "veil-citadel",
    title: "Cinder Span",
    region: "The ember bridge above the drowned forge",
    objective: "Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, clear three assault waves, then break the Cinder Warden.",
    nodeGoal: 1,
    bossName: "Cinder Warden",
    bossHealth: 8,
    rewardIntegrityRestore: 1,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 3,
        counter: Object.freeze({ mode: "threshold", minimumLegion: 4, belowDamage: 2, readyDamage: 1 })
      })
    }),
    encounter: Object.freeze({
      preparationSeconds: 8,
      preparationLegion: 2,
      waves: Object.freeze([
        Object.freeze({ id: "scout", spawnAtSeconds: 8, hostiles: 2, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "guard", spawnAtSeconds: 22, hostiles: 3, hostileHealth: 2, breachDamage: 1 }),
        Object.freeze({ id: "reinforcement", spawnAtSeconds: 36, hostiles: 3, hostileHealth: 2, breachDamage: 1 })
      ])
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "ember-cohort", name: "Ember Cohort", description: "Legion doctrine: Materialize raises 2 additional shades (base 2) for the remaining campaign.", effects: Object.freeze({ materializeBonus: 2 }) }),
      Object.freeze({ id: "rift-lens", name: "Rift Lens", description: "Burst doctrine: possession assaults deal +4 damage from Veil Citadel onward.", effects: Object.freeze({ possessedAssaultBonus: 4 }) }),
      Object.freeze({ id: "stillwater-hourglass", name: "Stillwater Hourglass", description: "Tempo doctrine: reduce command cooldowns by 20%; the second Hunt immediately extracts the soul cache.", effects: Object.freeze({ cooldownMultiplier: 0.8, autoExtract: true }) }),
      Object.freeze({ id: "shadebreaker-brand", name: "Bulwark Brand", description: "Bulwark doctrine: reduce every boss counterblow by 2 (never below 1).", effects: Object.freeze({ counterReduction: 2 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-011", region: "AS-WV-012", description: "AS-WV-013" }),
      boss: Object.freeze({ name: "AS-WV-014", description: "AS-WV-015" }),
      rewards: Object.freeze({
        "ember-cohort": Object.freeze({ name: "AS-WV-016", description: "AS-WV-017" }),
        "rift-lens": Object.freeze({ name: "AS-WV-018", description: "AS-WV-019" }),
        "stillwater-hourglass": Object.freeze({ name: "AS-WV-020", description: "AS-WV-021" }),
        "shadebreaker-brand": Object.freeze({ name: "AS-WV-022", description: "AS-WV-023" })
      })
    })
  }),
  Object.freeze({
    id: "veil-citadel",
    number: 2,
    nextStageId: "echo-throne",
    title: "Veil Citadel",
    region: "A fortress of listening stone",
    objective: "Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil.",
    nodeGoal: 2,
    bossName: "Veil Tactician",
    bossHealth: 10,
    rewardIntegrityRestore: 1,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 3,
        possessedDamage: 1,
        requiresPossessed: true,
        counter: Object.freeze({ mode: "shielded", baseDamage: 2, shieldDivisor: 4, thinLegion: 4, thinPenalty: 1 })
      })
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "veil-vanguard", name: "Veil Vanguard", description: "Start Echo Throne with four shades already raised; this skips setup but remains a thin legion.", effects: Object.freeze({ stageEntry: Object.freeze({ "echo-throne": Object.freeze({ legion: 4 }) }) }) }),
      Object.freeze({ id: "anchor-shard", name: "Anchor Shard", description: "Recovery doctrine: restore 2 additional integrity when entering Echo Throne.", effects: Object.freeze({ stageEntry: Object.freeze({ "echo-throne": Object.freeze({ integrity: 2 }) }) }) }),
      Object.freeze({ id: "abyssal-banner", name: "Abyssal Banner", description: "Legion doctrine: enter with 1 aegis; every Materialize raises 1 additional shade; Lord's Domain adds its 2 aegis.", effects: Object.freeze({ entryAegis: 1, materializeBonus: 1 }) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-024", region: "AS-WV-025", description: "AS-WV-026" }),
      boss: Object.freeze({ name: "AS-WV-027", description: "AS-WV-028" }),
      rewards: Object.freeze({
        "veil-vanguard": Object.freeze({ name: "AS-WV-029", description: "AS-WV-030" }),
        "anchor-shard": Object.freeze({ name: "AS-WV-031", description: "AS-WV-032" }),
        "abyssal-banner": Object.freeze({ name: "AS-WV-033", description: "AS-WV-034" })
      })
    })
  }),
  Object.freeze({
    id: "echo-throne",
    number: 3,
    nextStageId: null,
    title: "Echo Throne",
    region: "The gate above the last remembered sea",
    objective: "Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign.",
    nodeGoal: 1,
    bossName: "Gate Sovereign",
    bossHealth: 17,
    rewardIntegrityRestore: 1,
    progression: STANDARD_PROGRESSION,
    commands: Object.freeze({
      hunt: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.hunt }),
      extract: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.extract }),
      materialize: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.materialize }),
      capture: Object.freeze({ cooldown: STANDARD_COMMAND_COOLDOWNS.capture }),
      possess: Object.freeze({ requiresNodes: 1 }),
      domain: Object.freeze({ requiresNodes: 1, limit: 1, integrityRestore: 4, aegis: 2 }),
      assault: Object.freeze({
        cooldown: STANDARD_COMMAND_COOLDOWNS.assault,
        damage: 4,
        possessedDamage: 1,
        counter: Object.freeze({ mode: "shielded", baseDamage: 8, shieldDivisor: 4, thinLegion: 5, thinPenalty: 1 })
      })
    }),
    rewards: Object.freeze([
      Object.freeze({ id: "throne-echo", name: "Throne Echo", description: "Records the legion's final oath in the campaign archive.", effects: Object.freeze({}) }),
      Object.freeze({ id: "dawnless-crown", name: "Dawnless Crown", description: "Records a crown forged from the closed gate.", effects: Object.freeze({}) })
    ]),
    trace: Object.freeze({
      stage: Object.freeze({ name: "AS-WV-035", region: "AS-WV-036", description: "AS-WV-037" }),
      boss: Object.freeze({ name: "AS-WV-038", description: "AS-WV-039" }),
      rewards: Object.freeze({
        "throne-echo": Object.freeze({ name: "AS-WV-040", description: "AS-WV-041" }),
        "dawnless-crown": Object.freeze({ name: "AS-WV-042", description: "AS-WV-043" })
      })
    })
  })
]);

export const STAGES_BY_ID = Object.freeze(Object.fromEntries(STAGES.map((stage) => [stage.id, stage])));

export const CONTENT_TRACE = Object.freeze({
  "AS-WV-011": Object.freeze({ stageId: "cinder-span", entity: "stage", field: "name", value: "Cinder Span" }),
  "AS-WV-012": Object.freeze({ stageId: "cinder-span", entity: "stage", field: "region", value: "The ember bridge above the drowned forge" }),
  "AS-WV-013": Object.freeze({ stageId: "cinder-span", entity: "stage", field: "description", value: "Hunt the rift spoor, extract its shade, materialize a legion, seize the forge node, clear three assault waves, then break the Cinder Warden." }),
  "AS-WV-014": Object.freeze({ stageId: "cinder-span", entity: "boss", field: "name", value: "Cinder Warden" }),
  "AS-WV-015": Object.freeze({ stageId: "cinder-span", entity: "boss", field: "description", value: "The forge bridge's ashbound sentinel breaks intruders against the drowned iron." }),
  "AS-WV-016": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "ember-cohort", field: "name", value: "Ember Cohort" }),
  "AS-WV-017": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "ember-cohort", field: "description", value: "Legion doctrine: Materialize raises 2 additional shades (base 2) for the remaining campaign." }),
  "AS-WV-018": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "rift-lens", field: "name", value: "Rift Lens" }),
  "AS-WV-019": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "rift-lens", field: "description", value: "Burst doctrine: possession assaults deal +4 damage from Veil Citadel onward." }),
  "AS-WV-020": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "stillwater-hourglass", field: "name", value: "Stillwater Hourglass" }),
  "AS-WV-021": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "stillwater-hourglass", field: "description", value: "Tempo doctrine: reduce command cooldowns by 20%; the second Hunt immediately extracts the soul cache." }),
  "AS-WV-022": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "shadebreaker-brand", field: "name", value: "Bulwark Brand" }),
  "AS-WV-023": Object.freeze({ stageId: "cinder-span", entity: "reward", rewardId: "shadebreaker-brand", field: "description", value: "Bulwark doctrine: reduce every boss counterblow by 2 (never below 1)." }),
  "AS-WV-024": Object.freeze({ stageId: "veil-citadel", entity: "stage", field: "name", value: "Veil Citadel" }),
  "AS-WV-025": Object.freeze({ stageId: "veil-citadel", entity: "stage", field: "region", value: "A fortress of listening stone" }),
  "AS-WV-026": Object.freeze({ stageId: "veil-citadel", entity: "stage", field: "description", value: "Carry your first boon, hold both signal nodes, possess a sentinel, and defeat the tactician who commands the veil." }),
  "AS-WV-027": Object.freeze({ stageId: "veil-citadel", entity: "boss", field: "name", value: "Veil Tactician" }),
  "AS-WV-028": Object.freeze({ stageId: "veil-citadel", entity: "boss", field: "description", value: "A tactician of listening stone that turns every uncovered route into a killing field." }),
  "AS-WV-029": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "veil-vanguard", field: "name", value: "Veil Vanguard" }),
  "AS-WV-030": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "veil-vanguard", field: "description", value: "Start Echo Throne with four shades already raised; this skips setup but remains a thin legion." }),
  "AS-WV-031": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "anchor-shard", field: "name", value: "Anchor Shard" }),
  "AS-WV-032": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "anchor-shard", field: "description", value: "Recovery doctrine: restore 2 additional integrity when entering Echo Throne." }),
  "AS-WV-033": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "abyssal-banner", field: "name", value: "Abyssal Banner" }),
  "AS-WV-034": Object.freeze({ stageId: "veil-citadel", entity: "reward", rewardId: "abyssal-banner", field: "description", value: "Legion doctrine: enter with 1 aegis; every Materialize raises 1 additional shade; Lord's Domain adds its 2 aegis." }),
  "AS-WV-035": Object.freeze({ stageId: "echo-throne", entity: "stage", field: "name", value: "Echo Throne" }),
  "AS-WV-036": Object.freeze({ stageId: "echo-throne", entity: "stage", field: "region", value: "The gate above the last remembered sea" }),
  "AS-WV-037": Object.freeze({ stageId: "echo-throne", entity: "stage", field: "description", value: "Carry both boons, secure the throne node, invoke the one-use Lord's Domain comeback, and unmake the Gate Sovereign." }),
  "AS-WV-038": Object.freeze({ stageId: "echo-throne", entity: "boss", field: "name", value: "Gate Sovereign" }),
  "AS-WV-039": Object.freeze({ stageId: "echo-throne", entity: "boss", field: "description", value: "The final gate's remembered ruler, holding back the last abyssal tide." }),
  "AS-WV-040": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "throne-echo", field: "name", value: "Throne Echo" }),
  "AS-WV-041": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "throne-echo", field: "description", value: "Records the legion's final oath in the campaign archive." }),
  "AS-WV-042": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "dawnless-crown", field: "name", value: "Dawnless Crown" }),
  "AS-WV-043": Object.freeze({ stageId: "echo-throne", entity: "reward", rewardId: "dawnless-crown", field: "description", value: "Records a crown forged from the closed gate." })
});

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

function rewardDefinition(reward) {
  const stage = STAGES_BY_ID[reward.stageId];
  return stage?.rewards.find((item) => item.id === reward.rewardId) ?? null;
}

function rewardBenefits(rewards) {
  const benefits = {
    maxIntegrity: BALANCE.maxIntegrity,
    cooldownMultiplier: 1,
    possessedAssaultBonus: 0,
    counterReduction: 0,
    materializeBonus: 0,
    autoExtract: false,
    entryAegis: 0,
    stageEntries: {},
    activeItemNames: []
  };

  for (const reward of rewards) {
    const definition = rewardDefinition(reward);
    if (!definition) continue;
    const effects = definition.effects;
    benefits.cooldownMultiplier *= effects.cooldownMultiplier ?? 1;
    benefits.possessedAssaultBonus += effects.possessedAssaultBonus ?? 0;
    benefits.counterReduction += effects.counterReduction ?? 0;
    benefits.materializeBonus += effects.materializeBonus ?? 0;
    benefits.autoExtract ||= effects.autoExtract === true;
    benefits.entryAegis += effects.entryAegis ?? 0;
    benefits.activeItemNames.push(definition.name);
    for (const [stageId, entry] of Object.entries(effects.stageEntry ?? {})) {
      const target = benefits.stageEntries[stageId] ?? { legion: 0, integrity: 0 };
      target.legion += entry.legion ?? 0;
      target.integrity += entry.integrity ?? 0;
      benefits.stageEntries[stageId] = target;
    }
  }
  return Object.freeze(benefits);
}

function entryBenefits(benefits, stage) {
  return benefits.stageEntries[stage.id] ?? { legion: 0, integrity: 0 };
}

export function getCampaignBenefits(state) {
  assertStateShape(state);
  const benefits = rewardBenefits(state.rewards);
  const echoThroneEntry = entryBenefits(benefits, STAGES_BY_ID["echo-throne"]);
  return Object.freeze({
    maxIntegrity: benefits.maxIntegrity,
    cooldownReduction: Number(clamp(1 - benefits.cooldownMultiplier, 0, 0.5).toFixed(12)),
    lensDamage: benefits.possessedAssaultBonus,
    vanguardLegion: echoThroneEntry.legion,
    anchorRestore: echoThroneEntry.integrity,
    extraAssaultDamage: 0,
    counterReduction: benefits.counterReduction,
    summonBonus: benefits.materializeBonus,
    autoExtract: benefits.autoExtract,
    initialAegis: benefits.entryAegis,
    activeItemNames: Object.freeze([...benefits.activeItemNames])
  });
}

function makeEncounterState(stage) {
  if (!stage.encounter) return undefined;
  return {
    waves: stage.encounter.waves.map((wave) => ({ id: wave.id, cleared: false, breaches: 0 })),
    activeWaveId: null,
    bossExposed: false,
    spawningStopped: false
  };
}

function encounterState(stageState, stage) {
  return stageState.encounter ?? makeEncounterState(stage);
}

function validateEncounterState(encounter, stage) {
  if (!stage.encounter) {
    assert(encounter === undefined, "This stage does not define an encounter.");
    return;
  }
  if (encounter === undefined) return;
  assert(encounter && typeof encounter === "object", "Stage encounter state is invalid.");
  assert(Array.isArray(encounter.waves) && encounter.waves.length === stage.encounter.waves.length, "Stage encounter waves are invalid.");
  assert(encounter.activeWaveId === null || typeof encounter.activeWaveId === "string", "Stage encounter active wave is invalid.");
  assert(typeof encounter.bossExposed === "boolean" && typeof encounter.spawningStopped === "boolean", "Stage encounter boss state is invalid.");

  let seenUncleared = false;
  for (let index = 0; index < encounter.waves.length; index += 1) {
    const progress = encounter.waves[index];
    const wave = stage.encounter.waves[index];
    assert(progress && progress.id === wave.id && typeof progress.cleared === "boolean", "Stage encounter wave state is invalid.");
    assert(Number.isInteger(progress.breaches) && progress.breaches >= 0, "Stage encounter breach count is invalid.");
    if (seenUncleared) assert(!progress.cleared, "Stage encounter waves must clear in order.");
    if (!progress.cleared) seenUncleared = true;
  }
  const activeIndex = encounter.waves.findIndex((wave) => !wave.cleared);
  const allCleared = activeIndex === -1;
  assert(encounter.bossExposed === allCleared, "Stage encounter boss exposure is invalid.");
  assert(encounter.spawningStopped === allCleared, "Stage encounter spawn state is invalid.");
  assert(allCleared ? encounter.activeWaveId === null : encounter.activeWaveId === null || encounter.activeWaveId === stage.encounter.waves[activeIndex].id, "Stage encounter active wave does not match the declared schedule.");
}

function makeStageState(stage, rewards, entryIntegrity) {
  const benefits = rewardBenefits(rewards);
  const entry = entryBenefits(benefits, stage);
  const capacity = MIN_SLOTS;
  const integrity = clamp(entryIntegrity, 0, benefits.maxIntegrity);
  const state = {
    hunted: 0,
    extracted: false,
    souls: 0,
    legion: Math.min(entry.legion, capacity),
    capacity,
    nodes: 0,
    possessed: false,
    domainUses: 0,
    aegis: benefits.entryAegis,
    integrity,
    entryIntegrity: integrity,
    bossHealth: stage.bossHealth
  };
  if (stage.encounter) state.encounter = makeEncounterState(stage);
  return state;
}

function makeCampaign() {
  return {
    rulesVersion: RULES_VERSION,
    stageId: STAGES[0].id,
    stageIndex: 0,
    status: "briefing",
    rewards: [],
    stage: makeStageState(STAGES[0], [], BALANCE.maxIntegrity),
    trace: [],
    revision: 0,
    lastMessage: "The abyss answers when you are ready."
  };
}

function stateStageId(state) {
  return typeof state.stageId === "string" ? state.stageId : STAGES[state.stageIndex]?.id;
}

function transition(state, mutate, event) {
  const next = clone(state);
  next.stageId = stateStageId(next);
  if (next.stage && activeStage(next).encounter && !next.stage.encounter) next.stage.encounter = makeEncounterState(activeStage(next));
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
  return STAGES_BY_ID[stateStageId(state)];
}

function assertStateShape(state) {
  assert(state && typeof state === "object", "Campaign state must be an object.");
  assert(state.rulesVersion === RULES_VERSION, "Campaign rules version is incompatible.");
  assert(Number.isInteger(state.stageIndex) && state.stageIndex >= 0 && state.stageIndex < STAGES.length, "Campaign stage index is invalid.");
  const stageId = stateStageId(state);
  assert(STAGES_BY_ID[stageId], "Campaign stage id is invalid.");
  assert(!state.stageId || STAGES[state.stageIndex].id === state.stageId, "Campaign stage id does not match its index.");
  assert(typeof state.status === "string", "Campaign status is invalid.");
  assert(Array.isArray(state.rewards) && Array.isArray(state.trace), "Campaign history is invalid.");
  assert(state.stage && typeof state.stage === "object", "Campaign stage state is invalid.");
  validateEncounterState(state.stage.encounter, activeStage(state));
}

function canAct(state) {
  return state.status === "active";
}

function stageComplete(next, stage) {
  next.status = "reward";
  next.lastMessage = `${stage.bossName} dissolves into ash. Choose one lasting boon.`;
}

function counterDamage(stageState, stage, benefits) {
  const counter = stage.commands.assault.counter;
  if (counter.mode === "threshold") {
    const base = stageState.legion >= counter.minimumLegion ? counter.readyDamage : counter.belowDamage;
    return Math.max(1, base - benefits.counterReduction);
  }
  const shield = Math.floor(stageState.legion / counter.shieldDivisor);
  const thin = stageState.legion < counter.thinLegion ? counter.thinPenalty : 0;
  return Math.max(1, Math.max(1, counter.baseDamage - shield) + thin - benefits.counterReduction);
}

function assaultDamage(stageState, stage, benefits) {
  const assault = stage.commands.assault;
  let damage = assault.damage;
  if (stageState.possessed) damage += (assault.possessedDamage ?? 0) + benefits.possessedAssaultBonus;
  return damage;
}

function guardAction(state, action) {
  assertStateShape(state);
  if (!ACTIONS.includes(action) || !activeStage(state).commands[action]) return rejected(state, "That command has no place in this stage.");
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

function guardAssault(state, stage, current) {
  const assault = stage.commands.assault;
  const encounter = encounterState(current, stage);
  if (encounter && !encounter.bossExposed) return rejected(state, "Clear Scout, Guard, and Reinforcement before assaulting the boss.");
  if (current.nodes < stage.nodeGoal) return rejected(state, "Hold every required node before the boss can be assaulted.");
  if (assault.requiresPossessed && !current.possessed) return rejected(state, `Possess a sentinel before confronting the ${stage.bossName}.`);
  return null;
}

function applyAssault(draft, stage) {
  const target = draft.stage;
  const benefits = rewardBenefits(draft.rewards);
  const damage = assaultDamage(target, stage, benefits);
  target.bossHealth = Math.max(0, target.bossHealth - damage);
  let counter = 0;
  if (target.aegis > 0) {
    target.aegis -= 1;
  } else {
    counter = counterDamage(target, stage, benefits);
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

function applyBreach(draft, damage) {
  const target = draft.stage;
  if (target.aegis > 0) {
    target.aegis -= 1;
    draft.lastMessage = "An abyssal breach strikes, but the aegis absorbs it.";
    return;
  }
  target.integrity = Math.max(0, target.integrity - damage);
  if (target.integrity === 0) {
    draft.status = "defeat";
    draft.lastMessage = "The breach shatters the legion's anchor. Regroup and retry this stage.";
    return;
  }
  draft.lastMessage = `An abyssal breach tears ${damage} integrity.`;
}

export function applyAction(state, action) {
  const blocked = guardAction(state, action);
  if (blocked) return blocked;

  const stage = activeStage(state);
  const current = state.stage;
  const progression = stage.progression;
  let message = "";

  if (action === "hunt") {
    if (current.hunted >= progression.huntGoal) return rejected(state, "The spoor is fully mapped. Extract the gathered shade.");
    message = current.hunted === 0 ? "You find a heatless footprint in the cinders." : "The second trace exposes the rift's pulse.";
  }
  if (action === "extract" && current.hunted < progression.huntGoal) return rejected(state, "Two spoor marks are required before extraction.");
  if (action === "materialize" && (current.souls < progression.materializeCost || current.legion >= current.capacity)) {
    return rejected(state, current.souls < progression.materializeCost ? "Extract enough shade before materializing a legion." : "Your legion slots are full.");
  }
  if (action === "capture" && (current.legion < 2 || current.nodes >= stage.nodeGoal)) {
    return rejected(state, current.legion < 2 ? "A legion of at least two shades must anchor the node." : "Every required node is already held.");
  }
  if (action === "possess") {
    const command = stage.commands.possess;
    if (current.nodes < command.requiresNodes || current.possessed) {
      return rejected(state, current.possessed ? "A sentinel is already possessed." : "Hold a signal node before taking a sentinel.");
    }
  }
  if (action === "domain") {
    const command = stage.commands.domain;
    if (current.nodes < command.requiresNodes || current.domainUses >= command.limit) {
      return rejected(state, current.domainUses >= command.limit ? "Lord's Domain may answer only once." : "Secure the throne node before opening the Domain.");
    }
  }
  if (action === "assault") {
    const assaultBlocked = guardAssault(state, stage, current);
    if (assaultBlocked) return assaultBlocked;
  }

  const next = transition(state, (draft) => {
    const target = draft.stage;
    const benefits = rewardBenefits(draft.rewards);
    if (action === "hunt") {
      target.hunted += 1;
      if (target.hunted === progression.huntGoal && benefits.autoExtract) {
        target.extracted = true;
        target.hunted = 0;
        target.souls += progression.soulsPerExtract;
        draft.lastMessage = "The second spoor opens into a soul cache before the rift can close.";
      } else {
        draft.lastMessage = message;
      }
    }
    if (action === "extract") {
      target.extracted = true;
      target.hunted = 0;
      target.souls += progression.soulsPerExtract;
      draft.lastMessage = "Four volatile shades tear free from the rift.";
    }
    if (action === "materialize") {
      const summoned = Math.min(progression.materializeSummon + benefits.materializeBonus, target.capacity - target.legion);
      target.souls -= progression.materializeCost;
      target.legion += summoned;
      draft.lastMessage = `${summoned} shadow ${summoned === 1 ? "answers" : "answer"} your call.`;
    }
    if (action === "capture") {
      target.nodes += 1;
      draft.lastMessage = `The node bends beneath the legion's banner (${target.nodes}/${stage.nodeGoal}).`;
    }
    if (action === "possess") {
      target.possessed = true;
      draft.lastMessage = "A sentinel's will is folded into your command; its fury rides your assaults.";
    }
    if (action === "domain") {
      const command = stage.commands.domain;
      target.domainUses = 1;
      target.integrity = clamp(target.integrity + command.integrityRestore, 0, benefits.maxIntegrity);
      target.aegis += command.aegis;
      draft.lastMessage = `Lord's Domain unfolds once: the abyss restores ${command.integrityRestore} integrity, and the next ${command.aegis} counterblows break against it.`;
    }
    if (action === "assault") applyAssault(draft, stage);
  }, { kind: "action", action });
  return accepted(next, next.lastMessage, action);
}

export function applyEncounterEvent(state, event) {
  assertStateShape(state);
  if (!canAct(state)) return rejected(state, "This stage is not accepting encounter events right now.");
  if (!event || typeof event !== "object" || typeof event.type !== "string") return rejected(state, "Encounter event is invalid.");

  const stage = activeStage(state);
  if (!stage.encounter) return rejected(state, "This stage has no declared encounter.");
  if (event.stageId !== stage.id) return rejected(state, "Encounter event belongs to a different stage.");
  const encounter = encounterState(state.stage, stage);

  if (event.type === "boss-assault") {
    const assaultBlocked = guardAssault(state, stage, state.stage);
    if (assaultBlocked) return assaultBlocked;
    const next = transition(state, (draft) => applyAssault(draft, stage), { kind: "encounter", event: clone(event) });
    return accepted(next, next.lastMessage, "boss-assault");
  }

  if (event.type !== "start-wave" && event.type !== "wave-cleared" && event.type !== "breach") {
    return rejected(state, "Encounter event type is unsupported.");
  }
  const activeIndex = encounter.waves.findIndex((wave) => !wave.cleared);
  if (activeIndex === -1) return rejected(state, "The encounter is complete; spawning has stopped.");
  const configuredWave = stage.encounter.waves[activeIndex];
  if (event.waveId !== configuredWave.id) return rejected(state, "Encounter events must target the next declared wave.");

  if (event.type === "start-wave") {
    if (encounter.activeWaveId !== null) return rejected(state, "The declared wave is already active.");
    const next = transition(state, (draft) => {
      draft.stage.encounter.activeWaveId = configuredWave.id;
      draft.lastMessage = `${configuredWave.id} wave has reached the battlefield.`;
    }, { kind: "encounter", event: clone(event) });
    return accepted(next, next.lastMessage, "start-wave");
  }

  if (encounter.activeWaveId !== configuredWave.id) {
    return rejected(state, "Start the declared wave before resolving its encounter events.");
  }
  const next = transition(state, (draft) => {
    const targetEncounter = draft.stage.encounter;
    const targetWave = targetEncounter.waves[activeIndex];
    if (event.type === "breach") {
      targetWave.breaches += 1;
      applyBreach(draft, configuredWave.breachDamage);
      return;
    }
    targetWave.cleared = true;
    targetEncounter.activeWaveId = null;
    const allCleared = targetEncounter.waves.every((wave) => wave.cleared);
    targetEncounter.bossExposed = allCleared;
    targetEncounter.spawningStopped = allCleared;
    draft.lastMessage = allCleared
      ? `${stage.bossName} is exposed. Spawning has stopped.`
      : `${configuredWave.id} wave cleared. The next wave remains on approach.`;
  }, { kind: "encounter", event: clone(event) });
  return accepted(next, next.lastMessage, event.type);
}

export function chooseReward(state, rewardId) {
  assertStateShape(state);
  if (state.status !== "reward") return rejected(state, "A reward can only be chosen after a stage victory.");
  const stage = activeStage(state);
  const reward = stage.rewards.find((item) => item.id === rewardId);
  if (!reward) return rejected(state, "That reward was not offered by this stage.");

  const next = transition(state, (draft) => {
    draft.rewards.push({ stageId: stage.id, rewardId: reward.id, rewardName: reward.name });
    const nextStage = stage.nextStageId ? STAGES_BY_ID[stage.nextStageId] : null;
    if (!nextStage) {
      draft.status = "campaign-complete";
      draft.lastMessage = `${reward.name} is claimed. The Gate Sovereign is gone, and Abyssal Command endures.`;
      return;
    }
    const benefits = rewardBenefits(draft.rewards);
    const entry = entryBenefits(benefits, nextStage);
    const carried = clamp(draft.stage.integrity + stage.rewardIntegrityRestore + entry.integrity, 0, benefits.maxIntegrity);
    draft.stageId = nextStage.id;
    draft.stageIndex = STAGES.indexOf(nextStage);
    draft.status = "active";
    draft.stage = makeStageState(nextStage, draft.rewards, carried);
    draft.lastMessage = `${reward.name} carries into ${nextStage.title}.`;
  }, { kind: "reward", rewardId });
  return accepted(next, next.lastMessage, "reward");
}

export function applyBattleBreach(state) {
  assertStateShape(state);
  if (!canAct(state)) return rejected(state, "The breach cannot reach a stage that is not active.");
  const stage = activeStage(state);
  if (stage.encounter) {
    const encounter = encounterState(state.stage, stage);
    const wave = encounter.waves.find((item) => !item.cleared);
    if (!wave) return rejected(state, "The encounter is complete; no wave can breach.");
    return applyEncounterEvent(state, { type: "breach", stageId: stage.id, waveId: wave.id });
  }
  const next = transition(state, (draft) => applyBreach(draft, 1), { kind: "battle-breach" });
  return accepted(next, next.lastMessage, "battle-breach");
}

export function retryStage(state) {
  assertStateShape(state);
  if (state.status === "briefing" || state.status === "campaign-complete" || state.status === "reward") {
    return rejected(state, "There is no active stage to retry.");
  }
  const next = clone(state);
  next.stageId = stateStageId(next);
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
    { id: "hunt", label: `Hunt ${current.hunted}/${stage.progression.huntGoal} rift spoor`, complete: current.hunted >= stage.progression.huntGoal || current.extracted },
    { id: "extract", label: "Extract a soul cache", complete: current.extracted },
    { id: "materialize", label: "Materialize a shadow legion", complete: current.legion >= 2 },
    { id: "capture", label: `Hold ${stage.nodeGoal} tech ${stage.nodeGoal === 1 ? "node" : "nodes"}`, complete: current.nodes >= stage.nodeGoal }
  ];
  if (stage.commands.possess) checklist.push({ id: "possess", label: "Possess a sentinel", complete: current.possessed });
  if (stage.commands.domain) checklist.push({ id: "domain", label: "Invoke Lord's Domain once", complete: current.domainUses === stage.commands.domain.limit });
  if (stage.encounter) {
    const encounter = encounterState(current, stage);
    for (const wave of encounter.waves) checklist.push({ id: `wave-${wave.id}`, label: `Clear ${wave.id} wave`, complete: wave.cleared });
  }
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
  assert(envelope.schema === SAVE_SCHEMA, "This file is not an Abyssal Command save.");
  assert(envelope.schemaVersion === SAVE_SCHEMA_VERSION, "This save schema is not supported by the Stage 1 encounter rules.");
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
    else if (event.kind === "battle-breach") result = applyBattleBreach(state);
    else if (event.kind === "encounter") result = applyEncounterEvent(state, event.event);
    else throw new Error("Save trace contains an unsupported event.");
    assert(result.accepted, "Save trace contains an impossible transition.");
    state = result.state;
  }
  return state;
}
