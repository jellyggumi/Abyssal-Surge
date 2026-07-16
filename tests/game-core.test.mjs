import assert from "node:assert/strict";
import test from "node:test";

import {
  RULES_VERSION,
  CAMPAIGN_SCHEDULES,
  awardFor,
  canonicalJson,
  commandCost,
  initialEncounter,
  makeCommand,
  reduceEncounter,
  replayEncounter,
  settleCampaign,
  validateDeterministicReplay,
} from "../game-core.js";

// P2 evidence: systems/rule-contract.md SYS-001–SYS-003 and SYS-002 ordering.
// P2 evidence: systems/balance-model.md SYS-007–SYS-008 counterplay cases.
// P2 evidence: systems/economy-ledger.md SYS-005–SYS-006 and ECO-INV-01–04.
// P2 evidence: systems/simulator-evidence.md corpus table and invariant results.
const CASES = Object.freeze({
  V: Object.freeze({
    schedule: Object.freeze(["STRIKE", "STRIKE", "STRIKE"]),
    plan: Object.freeze(["STRIKE", "STRIKE", "STRIKE"]),
    outcome: "VICTORY",
  }),
  HS: Object.freeze({
    schedule: Object.freeze(["STRIKE", "STRIKE", "STRIKE"]),
    plan: Object.freeze(["BRACE", "BRACE", "BRACE"]),
    outcome: "HOLD",
  }),
  HU: Object.freeze({
    schedule: Object.freeze(["STRIKE", "SURGE", "SURGE"]),
    plan: Object.freeze(["BRACE", "DISRUPT", "DISRUPT"]),
    outcome: "HOLD",
  }),
  RT: Object.freeze({
    schedule: Object.freeze(["STRIKE", "STRIKE", "STRIKE"]),
    plan: Object.freeze(["BRACE", "RECOVER", "BRACE"]),
    outcome: "HOLD",
  }),
  D: Object.freeze({
    schedule: Object.freeze(["SURGE", "SURGE", "STRIKE"]),
    plan: Object.freeze(["STRIKE", "STRIKE"]),
    outcome: "DEFEAT_INTEGRITY",
  }),
});

function recordsFor(plan) {
  return plan.map((command, tick) => makeCommand(command, tick, tick + 1));
}

function replayCase(label) {
  const scenario = CASES[label];
  return replayEncounter(scenario.schedule, recordsFor(scenario.plan));
}

function assertAccepted(result, name) {
  assert.deepEqual(result.results.map(({ accepted }) => accepted), Array(result.results.length).fill(true), name);
}

const CANONICAL_STAGE_CONFIGURATIONS = Object.freeze([
  Object.freeze({ max_integrity: 6, max_focus: 3, max_foe_health: 6, pressure: 0 }),
  Object.freeze({ max_integrity: 6, max_focus: 3, max_foe_health: 8, pressure: 0 }),
  Object.freeze({ max_integrity: 8, max_focus: 4, max_foe_health: 10, pressure: 0 }),
  Object.freeze({ max_integrity: 6, max_focus: 3, max_foe_health: 12, pressure: 1 }),
  Object.freeze({ max_integrity: 6, max_focus: 4, max_foe_health: 5, pressure: 0 }),
]);

function encounterConfiguration(state) {
  return {
    max_integrity: state.max_integrity,
    max_focus: state.max_focus,
    max_foe_health: state.max_foe_health,
    pressure: state.pressure,
  };
}

function firstLegalCommand(schedule) {
  return schedule[0] === "SURGE" ? "DISRUPT" : "BRACE";
}

test("each campaign schedule constructs its canonical fresh state and passes its first reduction", () => {
  for (const [stageIndex, schedule] of CAMPAIGN_SCHEDULES.entries()) {
    const encounter = initialEncounter(schedule);
    const command = firstLegalCommand(schedule);
    const result = reduceEncounter(encounter, makeCommand(command, 0, 1));

    assert.deepEqual(encounterConfiguration(encounter), CANONICAL_STAGE_CONFIGURATIONS[stageIndex], `stage ${stageIndex + 1} configuration`);
    assert.equal(encounter.disrupt_uses, 0, `stage ${stageIndex + 1} initializes DISRUPT usage`);
    assert.equal(result.accepted, true, `stage ${stageIndex + 1} fresh state passes reduction validation`);
  }
});

test("Stage 4 rejects pressure below its canonical start and accepts its first legal command", () => {
  const stageFour = initialEncounter(CAMPAIGN_SCHEDULES[3]);
  const forged = {
    ...stageFour,
    schedule: [...stageFour.schedule],
    trace: [...stageFour.trace],
    pressure: 0,
  };
  const before = canonicalJson(forged);
  const rejected = reduceEncounter(forged, makeCommand("BRACE", 0, 1));
  const accepted = reduceEncounter(stageFour, makeCommand(firstLegalCommand(stageFour.schedule), 0, 1));
  const raisedPressure = reduceEncounter(accepted.state, makeCommand("STRIKE", 1, 2));

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "STATE_CONFIGURATION");
  assert.strictEqual(rejected.state, forged);
  assert.equal(canonicalJson(forged), before);
  assert.equal(accepted.accepted, true);
  assert.equal(raisedPressure.accepted, true);
  assert.equal(raisedPressure.state.pressure, 3);
});

test("the public initializer rejects or normalizes a mismatched stage selection", () => {
  let encounter;

  try {
    encounter = initialEncounter(CAMPAIGN_SCHEDULES[0], 4);
  } catch (error) {
    assert.ok(error instanceof TypeError || error instanceof RangeError);
    return;
  }

  assert.deepEqual(encounterConfiguration(encounter), CANONICAL_STAGE_CONFIGURATIONS[0]);
  assert.equal(
    reduceEncounter(encounter, makeCommand(firstLegalCommand(encounter.schedule), 0, 1)).accepted,
    true,
  );
});

test("reduction rejects a forged state paired with another stage's maximum bounds", () => {
  const stageOne = initialEncounter(CAMPAIGN_SCHEDULES[0]);
  const forged = {
    ...stageOne,
    schedule: [...stageOne.schedule],
    trace: [...stageOne.trace],
    focus: 4,
    max_focus: 4,
    foe_health: 5,
    max_foe_health: 5,
  };
  const before = canonicalJson(forged);
  const result = reduceEncounter(forged, makeCommand("BRACE", 0, 1));

  assert.equal(result.accepted, false);
  assert.notEqual(result.reason, null);
  assert.strictEqual(result.state, forged);
  assert.equal(canonicalJson(forged), before);
});


test("P2 CP-STRIKE: BRACE exactly counters the displayed STRIKE", () => {
  const result = replayCase("HS");

  assertAccepted(result, "all three braced rounds are legal");
  assert.equal(result.state.outcome, "HOLD");
  assert.equal(result.state.integrity, 6);
  assert.equal(result.state.pressure, 0);
  assert.deepEqual(result.state.trace.map((event) => [event.command, event.adverse_damage, event.adverse_pressure]), [
    ["BRACE", 0, 0],
    ["BRACE", 0, 0],
    ["BRACE", 0, 0],
  ]);
});

test("P2 CP-SURGE: DISRUPT exactly counters the displayed SURGE", () => {
  const result = replayCase("HU");

  assertAccepted(result, "all disrupted SURGE rounds are legal");
  assert.equal(result.state.outcome, "HOLD");
  assert.equal(result.state.integrity, 6);
  assert.equal(result.state.pressure, 1);
  assert.equal(result.state.foe_health, 10);
  assert.deepEqual(result.state.trace.map((event) => [event.command, event.adverse_damage, event.adverse_pressure]), [
    ["BRACE", 0, 0],
    ["DISRUPT", 0, 0],
    ["DISRUPT", 0, 0],
  ]);
});

test("P2 RECOVER-TRADE and UNCOVERED-SURGE preserve their stated costs and defeat boundary", () => {
  const recoverTrade = replayCase("RT");
  const uncoveredSurge = replayCase("D");

  assertAccepted(recoverTrade, "recover trade commands are legal");
  assert.equal(recoverTrade.state.outcome, "HOLD");
  assert.equal(recoverTrade.state.integrity, 4);
  assert.equal(recoverTrade.state.pressure, 0);
  assert.deepEqual(recoverTrade.state.trace.map((event) => [event.command, event.adverse_damage, event.adverse_pressure]), [
    ["BRACE", 0, 0],
    ["RECOVER", 2, 0],
    ["BRACE", 0, 0],
  ]);

  assertAccepted(uncoveredSurge, "declining visible surge counters remains a legal choice");
  assert.equal(uncoveredSurge.state.outcome, "DEFEAT_INTEGRITY");
  assert.equal(uncoveredSurge.state.round, 2);
  assert.equal(uncoveredSurge.state.integrity, 0);
  assert.equal(uncoveredSurge.state.pressure, 4);
});


test("P2 ordering grants third-strike victory before that round's foe effect", () => {
  const result = replayCase("V");

  assertAccepted(result, "three strikes are legal");
  assert.equal(result.state.outcome, "VICTORY");
  assert.equal(result.state.round, 3);
  assert.equal(result.state.foe_health, 0);
  assert.equal(result.state.integrity, 2);
  assert.deepEqual(result.state.trace.at(-1), {
    round: 3,
    command: "STRIKE",
    foe_resolved: false,
    outcome: "VICTORY",
  });
});

test("public reduction rejects failed preconditions and leaves the supplied encounter unchanged", () => {
  const encounter = initialEncounter(CAMPAIGN_SCHEDULES[0]);
  const baseline = canonicalJson(encounter);

  const disrupt = reduceEncounter(encounter, makeCommand("DISRUPT", 0, 1));
  const recover = reduceEncounter(encounter, makeCommand("RECOVER", 0, 1));
  const unknown = reduceEncounter(encounter, {
    rules_version: RULES_VERSION,
    command: "UNKNOWN",
    tick: 0,
    sequence: 1,
  });

  assert.deepEqual(
    [disrupt.reason, recover.reason, unknown.reason],
    ["INTENT", "FOCUS_CAP", "UNKNOWN_COMMAND"],
  );
  assert.deepEqual(
    [disrupt.accepted, recover.accepted, unknown.accepted],
    [false, false, false],
  );
  assert.equal(canonicalJson(encounter), baseline);
});

test("terminal encounters reject later commands without post-terminal mutation", () => {
  const terminal = replayEncounter(["STRIKE", "STRIKE", "STRIKE"], recordsFor(["BRACE", "BRACE", "BRACE"])).state;
  const before = canonicalJson(terminal);
  const result = reduceEncounter(terminal, makeCommand("STRIKE", 3, 4));

  assert.equal(terminal.outcome, "HOLD");
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "TERMINAL");
  assert.strictEqual(result.state, terminal);
  assert.equal(canonicalJson(result.state), before);
});

test("replay orders records canonically, rejects duplicate sequences, and remains deterministic", () => {
  const ordered = recordsFor(CASES.V.plan);
  const reordered = [ordered[2], ordered[0], ordered[1]];
  const expected = replayEncounter(CASES.V.schedule, ordered);
  const replayed = replayEncounter(CASES.V.schedule, reordered);
  const deterministic = validateDeterministicReplay(CASES.V.schedule, reordered);
  const duplicate = replayEncounter(CASES.V.schedule, [ordered[0], ordered[0], ordered[1], ordered[2]]);

  assert.equal(canonicalJson(replayed.state), canonicalJson(expected.state));
  assert.equal(deterministic.matches, true);
  assert.equal(deterministic.canonical_state, canonicalJson(expected.state));
  assert.deepEqual(duplicate.results.map(({ accepted, reason }) => [accepted, reason]), [
    [true, null],
    [false, "DUPLICATE_SEQUENCE"],
    [true, null],
    [true, null],
  ]);
  assert.equal(canonicalJson(duplicate.state), canonicalJson(expected.state));
});

test("replay leaves input schedule and records immutable", () => {
  const schedule = [...CASES.V.schedule];
  const records = recordsFor(CASES.V.plan);
  const scheduleBefore = [...schedule];
  const recordsBefore = records.map((record) => ({ ...record }));

  replayEncounter(schedule, records);

  assert.deepEqual(schedule, scheduleBefore, "schedule array is not mutated by replay");
  assert.deepEqual(records, recordsBefore, "record objects are not mutated by replay");
});


test("P2 corpus campaign replays preserve victory-only fragment totals", () => {
  const campaigns = [
    ["C00", ["D", "D", "D", "D", "D"], 0],
    ["C01", ["HS", "D", "D", "D", "D"], 0],
    ["C02", ["V", "D", "D", "D", "D"], 2],
    ["C03", ["V", "HS", "D", "D", "D"], 2],
    ["C04", ["V", "HU", "D", "D", "D"], 2],
    ["C05", ["V", "RT", "D", "D", "D"], 2],
    ["C06", ["V", "V", "D", "D", "D"], 4],
    ["C07", ["V", "V", "HS", "D", "D"], 4],
    ["C08", ["V", "V", "HS", "HU", "D"], 4],
    ["C09", ["V", "V", "V", "V", "V"], 10],
  ];

  for (const [campaignId, labels, expectedFragments] of campaigns) {
    const outcomes = labels.map((label) => {
      const result = replayCase(label);
      assertAccepted(result, `${campaignId} ${label} commands are legal`);
      assert.equal(result.state.outcome, CASES[label].outcome, `${campaignId} ${label} outcome`);
      return result.state.outcome;
    });
    const settlement = settleCampaign(outcomes);

    assert.equal(settlement.fragments_earned, expectedFragments, `${campaignId} earned fragments`);
    assert.ok(settlement.fragments_earned >= 0 && settlement.fragments_earned <= 10, `${campaignId} earned cap`);
    assert.ok(settlement.fragment_wallet >= 0 && settlement.fragment_wallet <= 10, `${campaignId} wallet cap`);
    assert.ok(settlement.resolve_marks >= 0 && settlement.resolve_marks <= 2, `${campaignId} resolve cap`);
    assert.equal(
      settlement.fragments_earned,
      settlement.fragment_wallet + 3 * settlement.resolve_marks,
      `${campaignId} conservation`,
    );
  }
});

test("P2 settlement converts at most two three-fragment marks and conserves all earned fragments", () => {
  const settlement = settleCampaign(["VICTORY", "VICTORY", "VICTORY", "VICTORY", "VICTORY"]);

  assert.deepEqual(settlement, {
    fragments_earned: 10,
    fragment_wallet: 4,
    resolve_marks: 2,
  });
  assert.equal(settlement.fragments_earned, settlement.fragment_wallet + 3 * settlement.resolve_marks);
});

test("P2 HOLD settlement is a zero-fragment floor and preserves victory-only rewards", () => {
  assert.equal(awardFor("HOLD"), 0);
  assert.deepEqual(settleCampaign(["HOLD", "HOLD", "HOLD", "HOLD", "HOLD"]), {
    fragments_earned: 0,
    fragment_wallet: 0,
    resolve_marks: 0,
  });
  assert.equal(awardFor("VICTORY"), 2);
});

test("P2 Stage 5 makes repeated DISRUPT increasingly expensive and reactive play only holds", () => {
  const schedule = CAMPAIGN_SCHEDULES[4];
  const reactive = replayEncounter(schedule, recordsFor(["DISRUPT", "DISRUPT", "BRACE"]));

  assertAccepted(reactive, "the displayed two-button responses remain legal");
  assert.equal(commandCost(initialEncounter(schedule, 4), "DISRUPT"), 1);
  const afterFirstDisrupt = reduceEncounter(initialEncounter(schedule, 4), makeCommand("DISRUPT", 0, 1)).state;
  assert.equal(commandCost(afterFirstDisrupt, "DISRUPT"), 2);
  assert.equal(reactive.state.outcome, "HOLD");
  assert.equal(reactive.state.foe_health, 3);
  assert.equal(reactive.state.focus, 0);
  assert.equal(awardFor(reactive.state.outcome), 0);
});

test("V2 Stage 5 rejects a forged DISRUPT counter without discounting the next legal DISRUPT", () => {
  const firstDisrupt = reduceEncounter(initialEncounter(CAMPAIGN_SCHEDULES[4]), makeCommand("DISRUPT", 0, 1));

  assert.equal(firstDisrupt.accepted, true);
  assert.equal(firstDisrupt.state.disrupt_uses, 1);
  assert.equal(commandCost(firstDisrupt.state, "DISRUPT"), 2);

  const forged = { ...firstDisrupt.state, disrupt_uses: 0 };
  const before = canonicalJson(forged);
  const rejected = reduceEncounter(forged, makeCommand("DISRUPT", 1, 2));

  assert.equal(rejected.accepted, false);
  assert.strictEqual(rejected.state, forged);
  assert.equal(canonicalJson(forged), before);

  const legalSecondDisrupt = reduceEncounter(firstDisrupt.state, makeCommand("DISRUPT", 1, 2));

  assert.equal(legalSecondDisrupt.accepted, true);
  assert.equal(legalSecondDisrupt.state.disrupt_uses, 2);
  assert.equal(legalSecondDisrupt.state.focus, 1);
});

test("state provenance rejects Stage 5 counter and journal erasure without mutation", () => {
  const firstDisrupt = reduceEncounter(initialEncounter(CAMPAIGN_SCHEDULES[4]), makeCommand("DISRUPT", 0, 1));
  const forged = JSON.parse(JSON.stringify(firstDisrupt.state));
  forged.disrupt_uses = 0;
  forged.trace = [];
  const before = canonicalJson(forged);

  const rejected = reduceEncounter(forged, makeCommand("DISRUPT", 1, 2));

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.reason, "STATE_PROVENANCE");
  assert.strictEqual(rejected.state, forged);
  assert.equal(canonicalJson(forged), before);
});

test("state provenance accepts a JSON-cloned journal state with canonical next-state parity", () => {
  const firstDisrupt = reduceEncounter(initialEncounter(CAMPAIGN_SCHEDULES[4]), makeCommand("DISRUPT", 0, 1));
  const cloned = JSON.parse(JSON.stringify(firstDisrupt.state));
  const nextCommand = makeCommand("DISRUPT", 1, 2);

  const expected = reduceEncounter(firstDisrupt.state, nextCommand);
  const replayed = reduceEncounter(cloned, nextCommand);

  assert.equal(expected.accepted, true);
  assert.equal(replayed.accepted, true);
  assert.notStrictEqual(cloned, firstDisrupt.state);
  assert.equal(canonicalJson(replayed.state), canonicalJson(expected.state));
});

test("state provenance rejects malformed, extra, and terminal-continuing journals before reduction", () => {
  const firstDisrupt = reduceEncounter(initialEncounter(CAMPAIGN_SCHEDULES[4]), makeCommand("DISRUPT", 0, 1));
  const braceEvent = reduceEncounter(firstDisrupt.state, makeCommand("BRACE", 1, 2)).state.trace.at(-1);
  const terminal = replayCase("V").state;
  const malformed = JSON.parse(JSON.stringify(firstDisrupt.state));
  const extra = JSON.parse(JSON.stringify(firstDisrupt.state));
  const continuing = JSON.parse(JSON.stringify(terminal));
  malformed.trace = [{ command: "DISRUPT" }];
  extra.trace.push(braceEvent);
  continuing.trace.push(braceEvent);

  for (const [name, state, command] of [
    ["malformed", malformed, makeCommand("DISRUPT", 1, 2)],
    ["extra", extra, makeCommand("DISRUPT", 1, 2)],
    ["terminal-continuing", continuing, makeCommand("STRIKE", 3, 4)],
  ]) {
    const before = canonicalJson(state);
    const rejected = reduceEncounter(state, command);

    assert.equal(rejected.accepted, false, `${name} trace is rejected`);
    assert.equal(rejected.reason, "STATE_PROVENANCE", `${name} trace identifies its provenance failure`);
    assert.strictEqual(rejected.state, state, `${name} trace returns the supplied state`);
    assert.equal(canonicalJson(state), before, `${name} trace does not mutate the supplied state`);
  }
});

test("P2 Stage 5 exposes both a deliberate victory line and reachable losses", () => {
  const schedule = CAMPAIGN_SCHEDULES[4];
  const deliberate = replayEncounter(schedule, recordsFor(["STRIKE", "DISRUPT", "STRIKE"]));
  const strikeOnly = replayEncounter(schedule, recordsFor(["STRIKE", "STRIKE"]));
  const braceOnly = replayEncounter(schedule, recordsFor(["BRACE", "BRACE"]));

  assertAccepted(deliberate, "the deliberate trade line is legal");
  assert.equal(deliberate.state.outcome, "VICTORY");
  assert.equal(deliberate.state.integrity, 2);
  assert.equal(deliberate.state.pressure, 2);
  assert.equal(deliberate.state.foe_health, 0);
  assert.equal(awardFor(deliberate.state.outcome), 2);

  assertAccepted(strikeOnly, "strike-only commands are legal before defeat");
  assert.equal(strikeOnly.state.outcome, "DEFEAT_INTEGRITY");
  assert.equal(strikeOnly.state.round, 2);
  assertAccepted(braceOnly, "brace-only commands are legal before defeat");
  assert.equal(braceOnly.state.outcome, "DEFEAT_INTEGRITY");
  assert.equal(braceOnly.state.round, 2);
});


test("forged prior states reject malformed bounds, schedule/round coherence, intent, and transient values without mutation", () => {
  const cases = [
    {
      name: "out-of-bounds integrity",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[0]);
        state.integrity = 7;
        return state;
      },
      reason: "STATE_BOUNDS",
    },
    {
      name: "invalid schedule",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[0]);
        state.schedule = ["INVALID"];
        return state;
      },
      reason: "SCHEDULE",
    },
    {
      name: "invalid DISRUPT usage count",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[1]);
        state.disrupt_uses = -1;
        return state;
      },
      reason: "DISRUPT_USES",
    },
    {
      name: "active state past its schedule",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[0]);
        state.round = 3;
        return state;
      },
      reason: "ROUND_COHERENCE",
    },
    {
      name: "current foe intent mismatch",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[2]);
        state.foe_intent = "SURGE";
        return state;
      },
      reason: "FOE_INTENT",
    },
    {
      name: "stale guard",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[0]);
        state.guard = 2;
        return state;
      },
      reason: "TRANSIENT_STATE",
    },
    {
      name: "stale surge counter",
      forge: () => {
        const state = initialEncounter(CAMPAIGN_SCHEDULES[1]);
        state.surge_countered = true;
        return state;
      },
      reason: "TRANSIENT_STATE",
    },
  ];

  for (const { name, forge, reason } of cases) {
    const previous = forge();
    const before = canonicalJson(previous);
    let result;

    assert.doesNotThrow(() => {
      result = reduceEncounter(previous, makeCommand("BRACE", previous.round, 1));
    }, name);
    assert.equal(result.accepted, false, name);
    assert.equal(result.reason, reason, name);
    assert.strictEqual(result.state, previous, name);
    assert.equal(canonicalJson(previous), before, name);
  }
});
