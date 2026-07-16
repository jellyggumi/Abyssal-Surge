# Gate measurements ledger

**Navigation:** [production contract](../production/production-contract.md) · [retrospective schema](../retrospectives/cycle_retrospective.py) · [task manifest](../production/task-manifest.md)

All rows are deliberately `NOT-RUN` until a dated build/session evidence path is attached. A target is never a measured value.

## G1

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| 0 un-waived lore violations; 100% trace coverage | not-run | inventory-to-build audit | `design/worldview.md` (plan only) | NOT-RUN |

## G6 (Stage 1 operations draft)

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| telemetry fields implemented; rollback tested; p95 frame ≤16.7 ms; long frames <0.5%; 30-min stable memory; input ≤100 ms | not-run | instrumented browser/mobile session | `ops/telemetry-contract.md`, `engineering/architecture-contract.md` (plans only) | NOT-RUN |

## G7

| Threshold | Current measured value | Method | Evidence | Verdict |
|---|---|---|---|---|
| period 30–180 s, ≥3 actions, ≥1 reward, repeat proxy ≥70% | target 75 s; repeat not-run | 10 voluntary repeat sessions | `design/core-loop.md` (model only) | NOT-RUN |

## Future gate slots

G2, G3, G5, G8 attach in Stage 2; G4 and final G6 attach in Stage 3. Each must state canonical threshold, measured value, method, evidence paths, timestamp, revision loops, and verdict.