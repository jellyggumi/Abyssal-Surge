# Production task manifest

**Navigation:** [production contract](production-contract.md) · **next public beat:** Cinder Span offline vertical-slice playtest.

| Artifact | Stage | Owner | Gate | Status/next action |
|---|---:|---|---|---|
| `intake/production-brief.md` | 1 | Production | G1/G6/G7 | written; use as entry check |
| `design/trend-survey/{triage,context,solutions}.md` | 1 | Design | G8 handoff | written; frequency matrix pending |
| `qa/benchmark-notes.md`, `qa/test-plan.md` | 1 | QA | G7/G1/G6 | written; attach build sessions |
| `pm/{revenue-map,reward-bands,negotiation-record}.md` | 1 | PM | G5 handoff | written; no monetization |
| `design/{concept,worldview,balance-sheet,core-loop,novelty-scorecard,presentation-spec}.md` | 1 | Design | G1/G2/G4/G7/G8 | written; targets require validation |
| `engineering/{resource-manifest,architecture-contract}.md` | 1 | Engineering | G1/G6 | written; implement only original/versioned state |
| `ops/telemetry-contract.md` | 1 | Ops | G6 | written; instrument semantic events |
| `qa/{defect-register,gate-measurements}.md` | 1 | QA | G1/G6/G7 | written; current verdicts not-run |
| `production/gate-reviews/stage-1-{g1,g6,g7}.md` | 1 | Director | G1/G6/G7 | written; sign only with evidence |
| `production/handoffs/stage-2.md` | 2 | Director | G2/G3/G5/G7/G8 | written; create listed evidence before entry |
| `qa/{exploit-register,playtest-report}.md` | 2 | QA | G2/G3/G5/G7/G8 | planned in Stage 2 handoff |
| `pm/revenue-forecast.md`, runtime balance data/logs | 2 | PM/Engineering | G2/G5 | planned in Stage 2 handoff |
| `production/gate-reviews/stage-2-g{2,3,5,7,8}.md` | 2 | Director | G2/G3/G5/G7/G8 | planned after evidence |
| `engineering/{perf-budget,movement-optimization}.md` | 3 | Engineering | G6 | planned in Stage 3 handoff |
| `engineering/tech-verification/{browser-mobile,playwriter}.md` | 3 | Engineering/QA | G4/G6 | planned after instrumented sessions |
| `ops/{rollback-runbook,release-readiness}.md` | 3 | Ops | G6 | planned; rollback must be exercised |
| `qa/{regression-matrix,playtest-report}.md` | 3 | QA | G1/G4/G6 | planned after target matrix exists |
| `production/gate-reviews/stage-3-g{1,4,6}.md` | 3 | Director | G1/G4/G6 | planned after evidence |
| `retrospectives/{cycle_retrospective.py,requirements.txt,minimal-valid-retrospective.json,cycle-1-retrospective.md}` | closure | Production | all | written; Pydantic v2 example must pass |
| `production/decision-log.md` | all | Director | all | written; record exceptions/scope calls |

## Completion rule

A manifest row marked written is a documentation state only. A gate is passable only with the evidence named in its review and [measurement ledger](../qa/gate-measurements.md).