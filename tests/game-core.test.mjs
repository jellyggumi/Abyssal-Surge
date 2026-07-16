import assert from "node:assert/strict";
import test from "node:test";

import {
  RULES_VERSION,
  canonicalJson,
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
    schedule: Object.freeze(["SURGE", "SURGE", "STRIKE"]),
    plan: Object.freeze(["DISRUPT", "DISRUPT", "BRACE"]),
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
    ["DISRUPT", 0, 0],
    ["DISRUPT", 0, 0],
    ["BRACE", 0, 0],
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
  const encounter = initialEncounter(["STRIKE"]);
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


test("P2 corpus campaign replays produce the published fragment totals", () => {
  const campaigns = [
    ["C00", ["D", "D", "D", "D", "D"], 0],
    ["C01", ["HS", "D", "D", "D", "D"], 1],
    ["C02", ["V", "D", "D", "D", "D"], 2],
    ["C03", ["V", "HS", "D", "D", "D"], 3],
    ["C04", ["V", "HU", "D", "D", "D"], 3],
    ["C05", ["V", "RT", "D", "D", "D"], 3],
    ["C06", ["V", "V", "D", "D", "D"], 4],
    ["C07", ["V", "V", "HS", "D", "D"], 5],
    ["C08", ["V", "V", "HS", "HU", "D"], 6],
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


test("forged prior states reject malformed bounds, schedule/round coherence, intent, and transient values without mutation", () => {
  const cases = [
    {
      name: "out-of-bounds integrity",
      forge: () => {
        const state = initialEncounter(["STRIKE"]);
        state.integrity = 7;
        return state;
      },
      reason: "STATE_BOUNDS",
    },
    {
      name: "invalid schedule",
      forge: () => {
        const state = initialEncounter(["STRIKE"]);
        state.schedule = ["INVALID"];
        return state;
      },
      reason: "SCHEDULE",
    },
    {
      name: "active state past its schedule",
      forge: () => {
        const state = initialEncounter(["STRIKE"]);
        state.round = 1;
        return state;
      },
      reason: "ROUND_COHERENCE",
    },
    {
      name: "current foe intent mismatch",
      forge: () => {
        const state = initialEncounter(["STRIKE", "SURGE"]);
        state.foe_intent = "SURGE";
        return state;
      },
      reason: "FOE_INTENT",
    },
    {
      name: "stale guard",
      forge: () => {
        const state = initialEncounter(["STRIKE"]);
        state.guard = 2;
        return state;
      },
      reason: "TRANSIENT_STATE",
    },
    {
      name: "stale surge counter",
      forge: () => {
        const state = initialEncounter(["SURGE"]);
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
