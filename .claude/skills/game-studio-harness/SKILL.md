---
name: game-studio-harness
description: >
  Run the 5-agent game production studio: director, designer (numeric
  balance + combos + core loop), PM (revenue points + reward bands +
  forecast), programmer (extensible/stable implementation + perf +
  movement-path optimization), QA (archetype-rotation balance breaking +
  benchmark surveys + gate measurement). Executes the 3-stage operating
  cycle — Stage 1 concept/presentation/animation/resources/core build,
  Stage 2 balance/core-loop stability/novelty development, Stage 3 ops
  stability/play impact — gated by 8 numeric quality gates. Use to start a
  game production cycle, resume one, or run a stage-gate review. Triggers
  on: game production, game harness, 게임 제작, 게임 하네스, production cycle,
  stage gate, balance cycle, 게임 개발 사이클, run the studio, next cycle.
allowed-tools: Bash Read Write Edit Glob Grep TaskCreate TaskUpdate SendMessage
metadata:
  tags: game-production, orchestration, balance, monetization, qa, bmad-gds
  version: "1.0"
---

# Game Studio Harness

Producer-orchestrated agent team for full game production cycles, following
the bmad-gds method (intake brief → one operating mode → coordination
artifact → specialist routing → milestone thread) with numeric quality gates.

> Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` for agent-team mode.
> Without it, fall back to sequential sub-agent invocation in the same phase
> order (results return to the orchestrator; peer messages become files in
> `_workspace/{run-id}/messages/`).

## When to use this skill
- Start a new game production cycle from an idea, GDD, prototype, or existing build
- Resume an in-flight cycle (read the latest `_workspace/*/production/task-manifest.md` first)
- Run a stage-gate review (G1–G8 verdicts) on the current build
- Reprioritize when playtest feedback, defects, and milestone pressure collide
- 게임 제작/밸런스/수익화/QA 사이클을 하나의 팀으로 돌릴 때

## Team

| Agent | File | Owns |
|---|---|---|
| game-production-director | `.claude/agents/game-production-director.md` | Intake, task manifest, gate verdicts, arbitration, retrospective |
| game-designer | `.claude/agents/game-designer.md` | Balance sheet, combo matrix, core loop, novelty scorecard, worldview, presentation spec, trend surveys |
| game-pm | `.claude/agents/game-pm.md` | Revenue map, reward bands (comeback ≤30%, free/paid parity 10–20 sessions, win-rate delta ≤5%p), negotiation record, revenue forecast |
| game-programmer | `.claude/agents/game-programmer.md` | Architecture contract, perf budget (p95 ≤16.7ms, input ≤100ms), movement-path optimization, tech verification, telemetry, defect responses |
| game-qa | `.claude/agents/game-qa.md` | Archetype rotation (≥5 types), exploit register, benchmark survey, gate measurements, defect/regression registers |

Communication topology: director assigns and gates; QA broadcasts every
exploit/discovery to ALL agents with a feedback request; designer↔PM
negotiate reward/revenue couplings in a signed record; programmer answers
every defect within the cycle (`fixed` or `deferred` + reasoning).

## Instructions

### Step 0: Preparation
Why: every artifact must be traceable per run.
1. Derive `run-id` = `{YYYYMMDD}-{cycle-label}` and create `_workspace/{run-id}/{intake,design,pm,engineering,qa,ops,production,messages,retrospectives}/`.
2. If resuming, read the newest existing `_workspace/*/production/task-manifest.md` and the last retrospective; enter at the recorded stage instead of Stage 1.

### Step 1: Intake (director)
Normalize the request into `intake/production-brief.md` (bmad-gds schema:
game_type, team_shape, engine, current_stage, next_public_beat,
source_packet, main_constraint, main_question). Choose ONE operating mode
for the cycle and state the next public beat explicitly.

### Step 2: Team assembly
```
TeamCreate:
  members:
    - name: game-designer        definition: .claude/agents/game-designer.md
    - name: game-pm              definition: .claude/agents/game-pm.md
    - name: game-programmer      definition: .claude/agents/game-programmer.md
    - name: game-qa              definition: .claude/agents/game-qa.md
```
Director creates tasks per stage (see `references/stage-cycle.md`) with
owner, artifact path, and gate linkage. All paths absolute, anchored at
`_workspace/{run-id}/`.

### Step 3: Run the 3-stage operating cycle
Follow `references/stage-cycle.md` exactly. Summary:

- **Stage 1 — Concept, presentation, animation, resources, core build**:
  designer (concept + worldview + numeric skeleton + trend survey + core-loop
  candidate + presentation spec) ∥ PM (revenue-point draft) ∥ QA (benchmark
  survey + test plan + archetype set). Then designer↔PM negotiation round 1,
  then programmer builds core loop + presentation/animation + resource
  manifest + telemetry draft. Gate: G7 draft, G1 draft, G6-ops draft.
- **Stage 2 — Balance, core-loop stability, novelty development**:
  QA exploit hunt across archetypes → designer retune → PM reward-band
  adjustment → negotiation round 2 → programmer applies data changes →
  QA re-verification. Gate: G2, G3, G5, G7 final, G8.
- **Stage 3 — Ops stability and play impact (연출/시나리오/이펙트)**:
  programmer perf+memory+movement optimization and ops hardening ∥
  designer+programmer presentation/scenario/effect impact pass ∥ QA full
  regression + immersion scoring ∥ PM revenue-consistency forecast.
  Gate: G4, G6, G1 final.

Gate verdicts are PASS / FIX (≤2 revision loops) / REDO (previous stage).
An open S1 defect or missing evidence blocks any PASS.

### Step 4: Cycle close (director)
Write `retrospectives/cycle-{n}-retrospective.md`: per-gate measured values,
unresolved risks, and the next-cycle entry decision (Stage 1 concept shift
vs Stage 2 retune). The cycle loops — the studio is a standing structure,
not a one-shot pipeline.

### Step 5: Error handling
| Scenario | Response |
|---|---|
| Agent timeout | Retry once → mark task `failed`, continue partial, flag in gate review |
| Data conflict | Log `conflicts.md`; prefer newer measurement; director arbitrates numerically |
| Missing output | Gate cannot PASS; warn in review |
| Messaging failure | File-based fallback via `messages/` |

## Examples

### Example 1: New cycle from an idea
Input: "다크판타지 RTS 아이디어로 게임 제작 사이클 시작해줘"
Expected: run-id created, production brief written, team assembled, Stage 1
tasks assigned; designer's trend survey and QA's benchmark survey run via
skill://survey; cycle ends with retrospective + gate table.

### Example 2: Stage-gate review on existing build
Input: "현재 빌드로 스테이지 게이트 리뷰 돌려줘"
Expected: QA measures G1–G8 on the build, director issues per-gate
PASS/FIX/REDO verdicts with evidence paths, FIX items become tasks.

### Example 3: Balance emergency
Input: "QA가 무한조합 익스플로잇 찾음, 사이클 재진입"
Expected: enter at Stage 2; exploit register drives designer retune, PM
checks reward coupling, programmer applies data change, QA re-verifies band.

## Best practices
1. One operating mode per cycle — mixing concept work and launch ops in one pass weakens both.
2. Numbers gate everything: no adjective ever passes a gate (see `references/quality-gates.md`).
3. Surveys before invention: designer trend survey and QA benchmark survey are Stage 1 prerequisites, not optional garnish.
4. Preserve `_workspace/` artifacts — they are the studio's memory across cycles; never delete.
5. Keep the milestone thread: every task names the next public beat it serves.
6. QA broadcast discipline: every exploit/discovery goes to all agents with an explicit feedback request — QA sense is the studio's shared sense.

## References
- [Quality Gates G1–G8](references/quality-gates.md)
- [Stage Cycle Detail](references/stage-cycle.md)
- [Artifact Contract](references/artifact-contract.md)
