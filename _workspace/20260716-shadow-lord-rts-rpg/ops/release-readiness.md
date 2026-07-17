# Static Pages release-readiness record

**Current conclusion:** `NOT-RUN` — not release-ready. This document enumerates missing evidence; it does not convert existing plans, source inspection, or an unretained test result into a gate pass.

**Evidence:** [production gate ledger](../production/production-contract.md#gate-ledger) · [Stage 3 handoff](../production/handoffs/stage-3.md) · [G6 measurement ledger](../qa/gate-measurements.md#g6-stage-1-operations-draft) · [performance budget](../engineering/perf-budget.md) · [browser test contract](../../../tests/playtest-browser-3stage.cjs) · [Pages workflow](../../../.github/workflows/static.yml) · [rollback runbook](rollback-runbook.md)

## Scope and decision boundary

The release surface is the static GitHub Pages client. Canonical campaign state is browser-local IndexedDB, with local fallback/recovery behavior; the service worker caches versioned shell/assets. Android packaging, accounts/cloud save, co-op, and store release are later scope and cannot be used as a readiness substitute. See [architecture](../engineering/architecture-contract.md).

A release decision must name one full candidate SHA and retain evidence for that SHA. The workflow’s allowlist/import-closure checks are deployment guards, not an end-user, handset, accessibility, persistence, or gate verdict.

## Evidence still missing

| Required evidence | Required record | Current status |
|---|---|---|
| Candidate deployment identity | Full lowercase 40-character SHA, workflow run/deployment URL, timestamp, and allowed-artifact result for the exact candidate | `NOT-RUN`: no candidate release record is attached here. |
| Static artifact closure | Candidate-revision execution output for the committed allowlist/import-closure guard and [release-closure test](../../../tests/release-closure.test.mjs) | `NOT-RUN`: source/tests exist; this document records no candidate execution artifact. |
| Current-browser campaign proof | [Playwriter packet](../engineering/tech-verification/playwriter.md) with observe→act→observe snapshots for all three stages, revision/device fields, and captured console/page errors | `NOT-RUN`: no bridge-session capture is linked. |
| Handset/browser matrix | Named devices/browsers/viewports and per-session build/revision outcomes | `NOT-RUN`: Stage 3 requires the matrix; no matrix record is attached. |
| Final performance and soak | Instrumented handset/browser raw data proving p95 ≤16.7 ms, long frames <0.5%, input ≤100 ms, and stable memory through 30 minutes | `NOT-RUN`: the performance budget’s headless Chromium sample is not the required mobile/browser soak record. |
| Rollback rehearsal | Authorized full-SHA dispatch, workflow guard results, deployed URL, and post-deploy browser capture as specified in [rollback runbook](rollback-runbook.md) | `NOT-RUN`: the G6 ledger records rollback as unexercised. |
| Telemetry operation | Implemented semantic fields plus retained session data sufficient for the Stage 3 dashboard/diagnostic decisions | `NOT-RUN`: [telemetry contract](telemetry-contract.md) specifies fields, but the G6 ledger records no implementation/session proof. |
| G4 player evidence | Structured immersion/readability sessions showing median ≥4.0/5, feedback ≤100 ms, and zero unresolved S1/S2 readability complaints | `NOT-RUN`: no final scorecard/session evidence is attached. |
| Final G1 content audit | A dated source-to-inventory audit, violation/waiver result, and director review for the candidate | `NOT-RUN`: the current measurement ledger must be superseded only by retained audit evidence; this document makes no claim that source changes resolve it. |
| Stage 3 exit review | Final G1/G4/G6 reviews plus the validated retrospective required by the handoff | `NOT-RUN`: no final review/closure artifact is attached. |

## Candidate procedure

The following commands/scenarios must be associated with the exact candidate SHA and their outputs retained. They are instructions, not recorded results.

```bash
export CANDIDATE_SHA='<full lowercase 40-character SHA>'
git rev-parse --verify "${CANDIDATE_SHA}^{commit}"
node --test tests/release-closure.test.mjs
node tests/playtest-browser-3stage.cjs
```

Then dispatch or inspect the Pages deployment for that SHA. For recovery semantics, use the full-SHA-only procedure in [rollback runbook](rollback-runbook.md); do not treat an ordinary push as a rollback rehearsal. Complete the current-browser and handset/browser captures afterward, because the automated browser script does not replace a Playwriter bridge session or a 30-minute mobile soak.

## Release record template

```text
Readiness verdict: NOT-RUN | PASS | FAIL
candidate SHA: <full SHA>
workflow run/deployment URL: <captured>
static closure command + output artifact: <captured>
three-stage browser command + output artifact: <captured>
current-browser bridge packet: <captured or NOT-RUN>
handset/browser matrix: <captured or NOT-RUN>
performance/soak raw evidence: <captured or NOT-RUN>
rollback exercise record: <captured or NOT-RUN>
telemetry/session evidence: <captured or NOT-RUN>
G1/G4/G6 director reviews and retrospective: <captured or NOT-RUN>
```

Only a record with every required evidence path and the production ledger’s gate thresholds can support a release decision. Until then, retain the conclusion `NOT-RUN`.
