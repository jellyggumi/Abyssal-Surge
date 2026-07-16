# QA test plan — campaign contract

**Navigation:** [production contract](../production/production-contract.md) · [gate measurements](gate-measurements.md) · [defect register](defect-register.md)

## Stage 1 executable scenarios

| ID | Scenario | Expected result | Gate |
|---|---|---|---|
| S1-01 | Start new campaign | state begins at Cinder Span with capacity 10 | G7 |
| S1-02 | Defeat eligible Ash Echo | one targetable pool appears for 10 s | G7 |
| S1-03 | Arise under capacity | exactly one role materializes and pool is consumed | G7/G2 handoff |
| S1-04 | Arise at cap | action explains capacity block; pool is not silently consumed | G7 |
| S1-05 | Capture Sable Relay | capacity changes by +2, max 100; guardian opens | G7/G2 handoff |
| S1-06 | Defeat guardian | exactly two rewards appear; one choice persists and Stage 2 unlocks | G7 |
| S1-07 | Reload/export/import valid state | same campaign/reward state restores or failure preserves prior valid state | G6 draft |
| S1-08 | Touch and keyboard core actions | same semantic state transition and visible labels | G1/G4 handoff |
| S1-09 | Audit public strings/effects | each maps to worldview inventory ID | G1 |

## Stage 2 continuation

Run five archetypes: commander/node control, possession skirmish, slot-efficient swarm, elite formation, and comeback recovery. G3 requires three independently viable archetypes in the stated band; no Stage 1 result may be substituted.

## Stage 3 continuation

Run 30-minute soak, mobile browser matrix, effect/readability sessions, and full campaign save migration/regression. Final G4/G6 must use instrumented sessions.

## Exit discipline

Any S1 defect blocks the affected `PASS`. Measurements record method, raw value, timestamp, build/session reference, and evidence path in [gate measurements](gate-measurements.md).