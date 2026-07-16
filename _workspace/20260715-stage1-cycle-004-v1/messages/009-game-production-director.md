---
run_id: 20260715-stage1-cycle-004-v1
owner: game-production-director
created_at: 2026-07-16T05:30:00Z
immutable: true
append_only: true
decision_id: C004-D-024
message_type: user-mandate-record-and-handoff
input_artifacts:
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v15.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v15.md
  - /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v15.md
input_hashes:
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/decision-log-v15.md: 75e937ef1f692a4d5ba13325997e10dbe00c0ba9b3ca6ea2145a452e78db5092
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/task-manifest-v15.md: 44430cc0b303aa3072791aea53397993f90c29b9b37ca90e12baa3064c57124f
  /Users/jangyoung/orca/Abyssal-Surge/_workspace/20260715-stage1-cycle-004-v1/production/ownership-register-v15.md: 038c987af831f2c27a164b217c3f3cd9dcfb511b150f9aad3703ce96ef5cbe29
---
20260715-stage1-cycle-004-v1 | P3 | game-production-director -> all-roles | user-mandate-record-and-handoff | (this file) | blocking no

C004-D-024 is a NON-AUTHORIZING record. It authorizes no work inside this run. Every cycle-004 prohibition, boundary, QA `FAIL`, and operations `STOP-SHIP` veto remains absolute and unchanged. The C004-D-023 cleanup path remains this run's only authorized action.

## Recorded user mandate (2026-07-16, project owner)

The project owner issued a superseding product directive:

1. The product is confirmed as a real-time strategy (RTS) game operated with keyboard AND mouse. Planning documents and the llm-wiki must be updated and integrated to state this.
2. Per-detail production directives (RTS controls, stage 1-5 differentiation, resource generation via god-tibo-imagen/ElevenLabs, narrative/scene-transition polish, Playwright-verified QA, wiki documentation) are to be issued to the in-flight production effort.
3. Development proceeds through Stage 5 completion under the established harness flow (resource generation, QA verification, retrospectives per process step).

## Handoff declaration

Per workflow-contract `new_input_requires_new_run` and `reentry.opens_only_after external_approval_required=true`, the recorded user mandate constitutes external approval for a FRESH ISOLATED SUCCESSOR RUN. All detail-directive execution occurs exclusively in:

`_workspace/20260716-stage5-rts-detail-cycle-005-v1/`

Cycle-004 stays in P3 governance remediation until its own C004-D-023 path resolves; nothing in the successor run edits, supersedes, or reinterprets cycle-004 records. This message merely records the mandate and the handoff so the production session's history explains why detailed execution continues elsewhere.

## Baseline pin (read-only observation)

- `app.js` SHA-256 `17a3b8ccdaa7ef6f34254a7ab08d13f6c08504f1aabfe9b942740c1f882c4fb5`, mtime epoch `1784179436` (`2026-07-16T05:23:56Z`), deployed head commit `fb23184`.
- Shipped state: 5 stages playable E2E, RTS lane + tactical monitor + keyboard shortcuts live at https://jellyggumi.github.io/Abyssal-Surge/.

No QA PASS, operations readiness, phase completion, or release claim is made or implied by this record.
