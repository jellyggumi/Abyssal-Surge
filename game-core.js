export const RULES_VERSION = "stage1-rules-v2";
export const COMMANDS = Object.freeze(["STRIKE", "BRACE", "DISRUPT", "RECOVER"]);
export const OUTCOMES = Object.freeze(["ACTIVE", "VICTORY", "HOLD", "DEFEAT_INTEGRITY", "DEFEAT_PRESSURE"]);
export const CAMPAIGN_SCHEDULES = Object.freeze([
  Object.freeze(["STRIKE", "STRIKE", "STRIKE"]),
  Object.freeze(["SURGE", "STRIKE", "STRIKE"]),
  Object.freeze(["STRIKE", "SURGE", "STRIKE"]),
  Object.freeze(["STRIKE", "SURGE", "SURGE"]),
  Object.freeze(["SURGE", "SURGE", "STRIKE"]),
]);
const STAGE_CONFIGS = Object.freeze([
  Object.freeze({ max_integrity: 6, max_focus: 3, max_foe_health: 6, start_pressure: 0 }),
  Object.freeze({ max_integrity: 6, max_focus: 3, max_foe_health: 8, start_pressure: 0 }),
  Object.freeze({ max_integrity: 8, max_focus: 4, max_foe_health: 10, start_pressure: 0 }),
  Object.freeze({ max_integrity: 6, max_focus: 3, max_foe_health: 12, start_pressure: 1 }),
  Object.freeze({ max_integrity: 6, max_focus: 4, max_foe_health: 5, start_pressure: 0 }),
]);

const INTENTS = new Set(["STRIKE", "SURGE"]);
const COMMAND_SET = new Set(COMMANDS);
const TERMINAL = new Set(OUTCOMES.filter((outcome) => outcome !== "ACTIVE"));

function sameSchedule(left, right) {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}

function scheduleIndex(schedule) {
  for (let index = 0; index < CAMPAIGN_SCHEDULES.length; index += 1) {
    if (sameSchedule(CAMPAIGN_SCHEDULES[index], schedule)) {
      return index;
    }
  }
  return -1;
}

function assertSchedule(schedule) {
  if (!Array.isArray(schedule) || schedule.length < 1 || schedule.length > 3 || !schedule.every((intent) => INTENTS.has(intent))) {
    throw new TypeError("A Stage 1 schedule contains one to three STRIKE or SURGE intents.");
  }
}

function cloneState(state) {
  return {
    ...state,
    schedule: [...state.schedule],
    trace: [...state.trace],
  };
}

function appendTrace(state, event) {
  state.trace.push(event);
}

function reject(state, code) {
  return { accepted: false, reason: code, state };
}

function sameOwnKeySet(left, right) {
  const leftKeys = Reflect.ownKeys(left);
  const rightKeys = Reflect.ownKeys(right);
  return leftKeys.length === rightKeys.length && leftKeys.every((key) => rightKeys.includes(key));
}

function sameCanonicalValue(supplied, canonical) {
  if (canonical === null || typeof canonical !== "object") return Object.is(supplied, canonical);
  if (typeof supplied !== "object" || supplied === null || Array.isArray(supplied) !== Array.isArray(canonical)) return false;
  if (!sameOwnKeySet(supplied, canonical)) return false;
  return Reflect.ownKeys(canonical).every((key) => sameCanonicalValue(supplied[key], canonical[key]));
}

function canonicalStateFromTrace(schedule, trace) {
  if (!Array.isArray(trace)) return null;
  let state = initialEncounter(schedule);
  for (let index = 0; index < trace.length; index += 1) {
    const event = trace[index];
    if (!event || typeof event !== "object" || Array.isArray(event)) return null;
    const record = {
      rules_version: RULES_VERSION,
      command: event.command,
      tick: index,
      sequence: index + 1,
    };
    const validation = commandError(state, record);
    if (validation || state.outcome !== "ACTIVE") return null;
    const result = applyAcceptedTransition(state, record);
    if (!result.accepted) return null;
    state = result.state;
  }
  return state;
}

function hasCanonicalProvenance(state) {
  const canonical = canonicalStateFromTrace(state.schedule, state.trace);
  return canonical !== null && sameCanonicalValue(state, canonical);
}

function provenanceError(state) {
  try {
    return hasCanonicalProvenance(state) ? null : "STATE_PROVENANCE";
  } catch {
    return "STATE_PROVENANCE";
  }
}

function acceptedRecordResult(state, record) {
  const validation = commandError(state, record);
  if (validation) return reject(state, validation);
  if (state.outcome !== "ACTIVE") return reject(state, "TERMINAL");
  return applyAcceptedTransition(state, record);
}

function applyAcceptedTransition(previous, record) {
  const state = cloneState(previous);
  const playerError = resolvePlayer(state, record.command);
  if (playerError) return reject(previous, playerError);

  const resolvedRound = state.round + 1;
  if (state.foe_health === 0) {
    state.round = resolvedRound;
    state.outcome = "VICTORY";
    appendTrace(state, { round: resolvedRound, command: record.command, foe_resolved: false, outcome: state.outcome });
    assertBounds(state);
    return { accepted: true, reason: null, state };
  }

  let adverseDamage = 0;
  let adversePressure = 0;
  if (state.foe_intent === "STRIKE") {
    adverseDamage = Math.max(0, 2 - state.guard);
    state.integrity = Math.max(0, state.integrity - adverseDamage);
  } else if (!state.surge_countered) {
    adverseDamage = 4;
    adversePressure = 2;
    state.integrity = Math.max(0, state.integrity - adverseDamage);
    state.pressure = Math.min(4, state.pressure + adversePressure);
  }

  state.guard = 0;
  state.surge_countered = false;
  state.round = resolvedRound;
  if (state.integrity === 0) state.outcome = "DEFEAT_INTEGRITY";
  else if (state.pressure === 4) state.outcome = "DEFEAT_PRESSURE";
  else if (state.round === state.schedule.length) state.outcome = "HOLD";
  else state.foe_intent = state.schedule[state.round];

  appendTrace(state, {
    round: resolvedRound,
    command: record.command,
    foe_resolved: true,
    adverse_damage: adverseDamage,
    adverse_pressure: adversePressure,
    outcome: state.outcome,
  });
  assertBounds(state);
  return { accepted: true, reason: null, state };
}


function priorStateError(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return "MALFORMED_STATE";
  if (state.rules_version !== RULES_VERSION) return "STATE_RULES_VERSION";
  const stageIndex = scheduleIndex(state.schedule);
  if (stageIndex === -1) return "SCHEDULE";
  const config = STAGE_CONFIGS[stageIndex];
  if (
    state.max_integrity !== config.max_integrity
    || state.max_focus !== config.max_focus
    || state.max_pressure !== 4
    || state.max_foe_health !== config.max_foe_health
    || state.pressure < config.start_pressure
  ) return "STATE_CONFIGURATION";
  if (!Array.isArray(state.trace)) return "TRACE";
  if (!Number.isInteger(state.round) || state.round < 0 || state.round > state.schedule.length) return "ROUND";
  const bounded = [
    [state.integrity, 0, state.max_integrity],
    [state.focus, 0, state.max_focus],
    [state.guard, 0, 2],
    [state.pressure, 0, state.max_pressure],
    [state.foe_health, 0, state.max_foe_health],
  ];
  if (!bounded.every(([value, minimum, maximum]) => Number.isInteger(value) && value >= minimum && value <= maximum)) return "STATE_BOUNDS";
  if (!Number.isInteger(state.disrupt_uses) || state.disrupt_uses < 0 || state.disrupt_uses > state.schedule.length) return "DISRUPT_USES";
  let tracedDisruptUses = 0;
  for (const event of state.trace) {
    if (event && typeof event === "object" && event.command === "DISRUPT") tracedDisruptUses += 1;
  }
  if (state.disrupt_uses !== tracedDisruptUses) return "DISRUPT_USES";
  if (state.surge_countered !== false || state.guard !== 0) return "TRANSIENT_STATE";
  if (!OUTCOMES.includes(state.outcome)) return "OUTCOME";

  if (state.outcome === "ACTIVE") {
    if (state.round >= state.schedule.length) return "ROUND_COHERENCE";
    if (state.foe_intent !== state.schedule[state.round]) return "FOE_INTENT";
    if (state.integrity === 0 || state.pressure === 4 || state.foe_health === 0) return "ACTIVE_TERMINAL_VALUE";
  } else {
    if (state.round < 1 || state.foe_intent !== state.schedule[state.round - 1]) return "TERMINAL_COHERENCE";
    if (state.outcome === "VICTORY" && state.foe_health !== 0) return "TERMINAL_COHERENCE";
    if (state.outcome === "HOLD" && (state.round !== state.schedule.length || state.integrity === 0 || state.pressure === 4 || state.foe_health === 0)) return "TERMINAL_COHERENCE";
    if (state.outcome === "DEFEAT_INTEGRITY" && state.integrity !== 0) return "TERMINAL_COHERENCE";
    if (state.outcome === "DEFEAT_PRESSURE" && (state.integrity === 0 || state.pressure !== 4)) return "TERMINAL_COHERENCE";
  }
  return provenanceError(state);
}


function commandError(state, record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return "MALFORMED_RECORD";
  if (record.rules_version !== RULES_VERSION) return "RULES_VERSION";
  if (!Number.isSafeInteger(record.tick) || record.tick !== state.round) return "TICK";
  if (!Number.isSafeInteger(record.sequence) || record.sequence < 1) return "SEQUENCE";
  if (!COMMAND_SET.has(record.command)) return "UNKNOWN_COMMAND";
  return null;
}

function disruptCost(state) {
  return scheduleIndex(state.schedule) === 4 ? 1 + state.disrupt_uses : 1;
}

export function commandCost(state, command) {
  if (!COMMAND_SET.has(command)) throw new TypeError("Unknown command cost.");
  if (command === "RECOVER") return 0;
  if (command === "DISRUPT") return disruptCost(state);
  return 1;
}

function resolvePlayer(state, command) {
  const cost = commandCost(state, command);
  if (command === "STRIKE") {
    if (state.focus < cost) return "FOCUS";
    state.focus -= cost;
    state.foe_health = Math.max(0, state.foe_health - 2);
    return null;
  }
  if (command === "BRACE") {
    if (state.focus < cost) return "FOCUS";
    state.focus -= cost;
    state.guard = Math.min(2, state.guard + 2);
    return null;
  }
  if (command === "DISRUPT") {
    if (state.focus < cost) return "FOCUS";
    if (state.foe_intent !== "SURGE") return "INTENT";
    state.focus -= cost;
    state.disrupt_uses += 1;
    state.foe_health = Math.max(0, state.foe_health - 1);
    state.surge_countered = true;
    return null;
  }
  if (command === "RECOVER") {
    if (state.focus > 2) return "FOCUS_CAP";
    state.focus += 1;
    return null;
  }
  return "UNKNOWN_COMMAND";
}

function assertBounds(state) {
  const values = [
    [state.round, 0, 3],
    [state.integrity, 0, state.max_integrity],
    [state.focus, 0, state.max_focus],
    [state.guard, 0, 2],
    [state.pressure, 0, state.max_pressure],
    [state.foe_health, 0, state.max_foe_health],
  ];
  if (!values.every(([value, minimum, maximum]) => Number.isInteger(value) && value >= minimum && value <= maximum)) {
    throw new RangeError("Stage state left its immutable bounds.");
  }
}

export function initialEncounter(schedule = CAMPAIGN_SCHEDULES[0], stageIndex) {
  assertSchedule(schedule);
  const canonicalStageIndex = scheduleIndex(schedule);
  if (canonicalStageIndex === -1) {
    throw new RangeError("Unknown Stage 1 schedule.");
  }
  if (stageIndex !== undefined && stageIndex !== canonicalStageIndex) {
    throw new RangeError("Stage index does not match the Stage 1 schedule.");
  }
  const cfg = STAGE_CONFIGS[canonicalStageIndex];

  return {
    rules_version: RULES_VERSION,
    schedule: [...schedule],
    round: 0,
    integrity: cfg.max_integrity,
    max_integrity: cfg.max_integrity,
    focus: cfg.max_focus,
    max_focus: cfg.max_focus,
    guard: 0,
    pressure: cfg.start_pressure,
    max_pressure: 4,
    foe_health: cfg.max_foe_health,
    max_foe_health: cfg.max_foe_health,
    foe_intent: schedule[0],
    surge_countered: false,
    disrupt_uses: 0,
    outcome: "ACTIVE",
    trace: [],
  };
}

export function makeCommand(command, tick, sequence) {
  return Object.freeze({ rules_version: RULES_VERSION, command, tick, sequence });
}

export function reduceEncounter(previous, record) {
  const stateValidation = priorStateError(previous);
  if (stateValidation) return reject(previous, stateValidation);
  return acceptedRecordResult(previous, record);
}

export function replayEncounter(schedule, records) {
  assertSchedule(schedule);
  if (!Array.isArray(records)) throw new TypeError("Replay records must be an array.");
  const stageIndex = scheduleIndex(schedule);
  if (stageIndex === -1) {
    throw new RangeError("Unknown Stage 1 schedule.");
  }
  const ordered = [...records].sort((left, right) => left.tick - right.tick || left.sequence - right.sequence);
  const seenSequences = new Set();
  let state = initialEncounter(schedule);
  const results = [];
  for (const record of ordered) {
    if (seenSequences.has(record?.sequence)) {
      results.push({ accepted: false, reason: "DUPLICATE_SEQUENCE", state });
      continue;
    }
    seenSequences.add(record?.sequence);
    const result = acceptedRecordResult(state, record);
    results.push(result);
    if (result.accepted) state = result.state;
  }
  return { state, results };
}

export function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new TypeError("Canonical data requires safe integers.");
    return String(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  throw new TypeError("Unsupported canonical value.");
}

export function validateDeterministicReplay(schedule, records) {
  const first = replayEncounter(schedule, records).state;
  const second = replayEncounter(schedule, records).state;
  const firstCanonicalState = canonicalJson(first);
  const secondCanonicalState = canonicalJson(second);
  return Object.freeze({
    rules_version: RULES_VERSION,
    matches: firstCanonicalState === secondCanonicalState,
    first_state: first,
    second_state: second,
    canonical_state: firstCanonicalState,
  });
}

export function awardFor(outcome) {
  if (!TERMINAL.has(outcome)) throw new TypeError("Only a terminal encounter may be settled.");
  if (outcome === "VICTORY") return 2;
  return 0;
}

export function settleCampaign(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length !== 5 || !outcomes.every((outcome) => TERMINAL.has(outcome))) {
    throw new TypeError("Stage 1 settlement requires exactly five terminal encounters.");
  }
  const fragments_earned = outcomes.reduce((total, outcome) => total + awardFor(outcome), 0);
  let fragment_wallet = fragments_earned;
  let resolve_marks = 0;
  while (fragment_wallet >= 3 && resolve_marks < 2) {
    fragment_wallet -= 3;
    resolve_marks += 1;
  }
  return Object.freeze({ fragments_earned, fragment_wallet, resolve_marks });
}
