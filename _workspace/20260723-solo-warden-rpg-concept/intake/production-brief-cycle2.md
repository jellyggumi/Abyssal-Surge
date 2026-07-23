# Production Brief — Cycle 2 (Progression-Aware Stage 1-10 Resource Validation)

**game_type**: PvE idle-progression defense-survivor with RPG layer (Solo Warden concept)
**team_shape**: director acting as programmer/QA/designer/PM (tripled-role fan-out per role, subagent-executed)
**engine**: vanilla JS, browser Canvas2D + Three.js hybrid renderer, no build step
**current_stage**: entering Stage 1 of Cycle 2 (Cycle 1 shipped the RPG layer implementation; Cycle 1's retrospective flagged this exact gap as next-cycle scope)
**next_public_beat**: 10-stage campaign with RPG progression that is provably beatable stage-by-stage under the *actual* accumulated resource curve (not an end-state maxed build) — closes `stage-progression.md` §6's explicitly-deferred TTK validation.

**source_packet**: `_workspace/20260723-solo-warden-rpg-concept/design/stage-progression.md` (the full 10-stage ground table: boss HP 40,000→150,000, Echo Core/Bound Fragment accumulation, trait unlock sequence 2/4/6/8/10, Undertow immunity boundary at Stage 6) + `design/balance-sheet.md` (G2 band: `ttk_target_s: 11.2`, `ttk_tolerance: 0.15`, `win_rate_band: [0.45, 0.55]`).

**main_constraint**: Isolated git worktree (`../Abyssal-Surge-cycle2`, branch `cycle2-stage-progression`) — Cycle 1's retrospective identified shared-working-tree contamination (checking hunk *count* not hunk *content* while other concurrent agents wrote the same files) as the root cause of 2 production-breaking pushes. This cycle runs entirely isolated; no plumbing gymnastics needed, `git add`/`git commit` are safe here.

**main_question**: Does player power (Track A stat/skill/trait investment + Track B equipment tier, accumulated at the exact per-stage pace `stage-progression.md` §1 specifies) keep pace with boss HP scaling (+275% from Stage 1 to Stage 10) such that TTK stays within the authored ±15% band at every stage — not just at the campaign endpoint?

## Operating mode for this cycle
**Balance validation + targeted retune**, not new-concept work. All game design/systems already shipped in Cycle 1; this cycle measures whether they compose correctly across the full progression curve and retunes only if the measurement finds a real drift.

## Scope
1. **Stage 1 (구현)**: Build a progression-aware simulation harness that applies `stage-progression.md`'s exact per-stage accumulated resources (not end-state) and measures real per-stage TTK, win-condition, and trait-unlock-boundary behavior across all 10 stages.
2. **Stage 2 (디테일 및 안정성 검증)**: Analyze TTK band violations (if any), record design decisions (band override vs retune), re-verify reward bands and R1/R3/R5 governance under the progression-aware model, confirm no regression in the existing 165-test suite.
3. **Stage 3 (운영수준 배포)**: Perf/memory regression across the full 10-stage arc, accessibility re-check, scoped commit, GitHub push, Pages deployment verification (including the still-pending `engine_contract` pre-existing-bug status from Cycle 1).

## Explicitly out of scope this cycle
- G4/G7 human-playtest-dependent measures (immersion score, repeat-rate proxy) — still require an actual human playtest round, not fabricable by simulation.
- G8 novelty scoring — designer work against `design/trend-survey/`, unrelated to this cycle's TTK-validation question.
- The pre-existing `engine_contract` reward-selection test failures (confirmed broken at `b0a0c57`, before any RPG work) — tracked in Cycle 1's `production/task-manifest.md`, not this cycle's defect to fix.
