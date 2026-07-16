# Abyssal Surge production contract — cycle 1

- **Run:** `20260716-shadow-lord-rts-rpg`
- **Status:** Stage 1 specification packet; all measured gate verdicts are `NOT-RUN` unless a dated evidence path says otherwise.
- **Audience/action:** production director coordinates an original-only, static-hosted three-stage campaign without treating design targets as completed implementation.
- **Next public beat:** offline Cinder Span vertical-slice playtest.

## Source hierarchy and evidence labels

1. This production contract and its linked workspace documents are the cycle source of truth.
2. [Game research](../qa/benchmark-notes.md) contains observed external patterns and source links.
3. The legacy design draft is an **observed input only**; its external IP content is rejected by the [worldview](../design/worldview.md).
4. **Observed** means sourced or directly measured. **Decision** means accepted scope/value. **Target** means not yet measured. **Not-run** is never pass evidence.

## Public IP boundary

Abyssal Surge is original-only. Every player-visible string, effect, scenario, and asset must trace to the [worldview inventory](../design/worldview.md) and [resource manifest](../engineering/resource-manifest.md). Third-party IP references block G1; no waiver may grant distribution rights.

## Campaign contract

| Stage | Required chain | Carry | Completion reward |
|---|---|---|---|
| 1 Cinder Span | hunt → extract → materialize legion → capture tech node → break Rift Guardian | new campaign | Cinder March **or** Relay Ward |
| 2 Veil Citadel | carry reward → unlock possession → hold two nodes → tactical boss | Stage 1 reward | Stage 2 pair, exactly one |
| 3 Echo Throne | carry reward → bounded Lord’s Domain → defeat Gate Sovereign | Stage 2 reward | campaign completion |

## Gate ledger

| Gate | Threshold | Cycle stage | Current evidence state | Owner |
|---|---|---|---|---|
| G1 Narrative consistency | 0 un-waived violations; 100% content trace | 1 draft, 3 final | NOT-RUN; inventory only | Design + QA |
| G2 Rules/balance | 100% mechanics; win rates 45–55%; TTK ±15%; no combo >1.3× median EV | 2 | not yet measurable | Design + QA |
| G3 Player diversity | 3 viable of 5; no >50% dominance | 2 | not-run | QA |
| G4 Immersion/readability | median ≥4/5; feedback ≤100 ms; 0 unresolved S1/S2 readability | 3 | not-run | Design + QA |
| G5 Revenue/balance | paid/free delta ≤5 pp; reversal ≤30%; free parity 10–20 sessions | 2 | no revenue surface | PM + QA |
| G6 Ops/performance | telemetry, rollback, checklist; p95 ≤16.7 ms; long frames <0.5%; 30-min stable; input ≤100 ms | 1 draft, 3 final | NOT-RUN | Engineering + Ops |
| G7 Core loop | 30–180 s, ≥3 actions, ≥1 reward, repeat ≥70% | 1 model, 2 final | target 75 s; not-run | Design + QA |
| G8 Novelty | ≤2/5 comparable frequency; impression ≥4/5 | 2 | not-run | Design + QA |

## Persistent-state and service boundary

- **Now:** IndexedDB is canonical local campaign storage; localStorage only settings/recovery pointer; versioned asset cache only; export/import recovery. See [architecture](../engineering/architecture-contract.md).
- **Cloud later:** opt-in account/cloud envelope only after Auth/RLS policy, isolation proof, conflict UI, and offline-cache policy. Static hosting remains the client surface.
- **Co-op later:** invite-only two-player authoritative external room after deterministic reconnect/desync/hibernation tests. No client-submitted result is authoritative.
- **APK later:** packaging is out of this cycle and has no pass claim.

## Stage exits

- **Stage 1 exit:** G1, G7, and G6 draft must have evidence paths and director review; open S1 or a missing measured requirement blocks exit. See [Stage 1 reviews](gate-reviews/stage-1-g1.md).
- **Stage 2 exit:** G2/G3/G5/G7-final/G8 pass with simulations and playtest evidence; see [handoff](handoffs/stage-2.md).
- **Stage 3 exit:** G1-final/G4/G6-final pass with mobile sessions, soak, rollback, and release evidence; see [handoff](handoffs/stage-3.md).

## Artifact index

- [Intake](../intake/production-brief.md)
- **Design:** [concept](../design/concept.md), [worldview](../design/worldview.md), [core loop](../design/core-loop.md), [balance](../design/balance-sheet.md), [presentation](../design/presentation-spec.md), [novelty](../design/novelty-scorecard.md), [survey](../design/trend-survey/triage.md)
- **PM:** [revenue map](../pm/revenue-map.md), [reward bands](../pm/reward-bands.md), [negotiation record](../pm/negotiation-record.md)
- **QA:** [benchmarks](../qa/benchmark-notes.md), [test plan](../qa/test-plan.md), [defects](../qa/defect-register.md), [measurements](../qa/gate-measurements.md)
- **Engineering/Ops:** [resource manifest](../engineering/resource-manifest.md), [architecture](../engineering/architecture-contract.md), [telemetry](../ops/telemetry-contract.md)
- **Production:** [task manifest](task-manifest.md), [decision log](decision-log.md), [Stage 2 handoff](handoffs/stage-2.md), [Stage 3 handoff](handoffs/stage-3.md), [gate reviews](gate-reviews/stage-1-g1.md)
- **Reflection:** [typed schema](../retrospectives/cycle_retrospective.py), [Pydantic v2 dependency](../retrospectives/requirements.txt), [minimal valid example](../retrospectives/minimal-valid-retrospective.json), [retrospective template](../retrospectives/cycle-1-retrospective.md)