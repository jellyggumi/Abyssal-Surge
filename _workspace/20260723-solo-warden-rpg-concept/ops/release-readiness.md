# Release readiness — Solo Warden RPG layer, Cycle 1

**Status as of this document: already deployed and live** (commits
`233a9d0` through `1030019`, CI `release_receipt.all_gate_pass=true` as of
`e7d5e8d`, live site verified 200 at
https://jellyggumi.github.io/Abyssal-Command/). This is **not** a
pre-deploy gate — the harness's G1-G8 framework governs quality
confidence, not the CI deploy gates (`engine_contract` through
`release_receipt`), which are the actual "does it ship" mechanism and
already passed. This document consolidates the real G1-G8 state across
all 3 stage-gate reviews so the next cycle inherits an accurate picture
instead of re-deriving it.

## G1-G8 status (compiled from `production/gate-reviews/stage{1,2,3}-review.md`, not re-measured here)

| Gate | Final verdict this cycle | What's real | What's still open |
|---|---|---|---|
| G1 — Narrative consistency | **PASS** (Stage1 draft PASS, Stage3 final PASS) | 0 lore violations across every string/mechanic this cycle added; 100% traced to `design/worldview.md`/`UNIFIED-GDD.md`; Stage3 final re-audit found 0 new narrative surface introduced in Stage2/3 work | Nothing — closed |
| G2 — Rules & balance | **FIX** (Stage2) | 7-archetype×3-seed real sweep, max efficiency deviation 1.166× (within the harness's 1.3× precedent) | (1) `win_rate_band [0.45,0.55]` is a genre mismatch for this PvE game — needs a director-authored `balance-sheet.md#band-overrides` entry, not more measurement; (2) no RPG-layer TTK target exists yet to validate against |
| G3 — Player-type diversity | **PASS** | 7/7 archetypes viable (exceeds ≥5 floor), no dominance, PRED-08 resolved (formation-diversity axis has real teeth) | Non-blocking finding forwarded to designer: 100% clear rate across all archetypes/seeds suggests Stage curve may be undertuned relative to RPG power — recommend a `wardenProgress: null` isolation re-run next cycle |
| G4 — Effects/immersion | **FIX** (Stage3) | Accessibility sub-measures clean PASS: touch target ≥48dp (0/10 below floor), color-independent tier encoding (verified under real grayscale render), reduced-motion parity (zero new transition rules) | Median immersion score and effect-latency spot-checks genuinely require human playtest scoring or a purpose-built scripted latency harness — neither exists yet; 0-unresolved-S1/S2-complaints has no complaint corpus to audit (no playtest has happened) |
| G5 — Revenue/balance synergy | **N/A** | No monetization in this project (explicit no-commerce boundary) | Structurally out of scope, not a gap |
| G6 — Game-ops | **FIX → partially closed this session** | Perf budget MET (16.6-16.7ms rAF-mean with growth panel present, +6.9% heap over 20k-tick soak with no leak); telemetry contract MET (`ops/telemetry-contract.md`, written this session, grounded in the 5 verified event types + 9/9 `defense-observers-contract.test.mjs`); `ops/rollback-runbook.md` and this file now exist (written this session, grounded in a real cross-version code test, not a template) | `ops/rollback-runbook.md` has **not** been tested via a live `workflow_dispatch` — deliberately not attempted this session since triggering a real production rollback against the live deployed site is a genuinely risky operational action requiring explicit human authorization, not something to fabricate or take unilaterally. This remains the one real open item for full G6. |
| G7 — Core loop | **PASS draft → FIX final** (Stage2) | Loop modeled + implemented with live-fire evidence (Boss Rally Window, formation targeting, DOWNED-state all confirmed firing in driven runs) | `repeat_rate_proxy ≥0.70` requires actual playtest sessions or a scripted would-replay heuristic (e.g. derived from accumulated real idle-return telemetry over time) — not derivable from a simulation-only archetype sweep, which measures clear-capability, not replay-desire |
| G8 — Novelty | **PENDING** (Stage2, genuinely unstarted) | — | Requires designer's novelty-scorecard cross-referenced against `design/trend-survey/` frequency data; this implementation cycle never touched novelty-survey artifact class. Flagged candidate worth checking: Whiteout Survival's "shared level pool" novelty note in the existing survey data, against this cycle's formation/rally system |

## Supplementary governance (load-bearing for G2/G3, not a formal gate)

- **R3** (item/trait multiplicative-stacking ceiling): PASS.
- **R1** (Stage1-derived stat/skill power ceiling): PENDING full-protocol
  measurement — isolated stress-test shows a real effect but not the
  literal all-10-stage/realistic-loadout protocol the harness specifies.
- **R5** (dual permanent-growth-axis compounding ceiling): unreachable by
  construction within the current 10-stage/no-NG+ scope — not violated,
  but not meaningfully "passed" either (New Game Plus scope is explicitly
  undecided, `UNIFIED-GDD.md` §12 item 6).

## What "release readiness" means for this project's actual deploy mechanism

This project's real ship gate is the 8-job CI pipeline in
`.github/workflows/static.yml`
(`resolve_revision → {engine_contract, release_closure, browser_contract}
→ package_pages → artifact_smoke → deploy_pages → deployed_smoke →
release_receipt`), not a manual G1-G8 checklist sign-off — the G1-G8
framework governs whether the *content* is good, the CI pipeline governs
whether the *deploy* is safe. Both matter; they are not substitutes for
each other. As of `e7d5e8d`, the CI pipeline is fully green
(`release_receipt.json`'s `all_gate_pass: true`) and the site is live.
G1-G8's remaining FIX/PENDING items above are quality-confidence gaps for
future cycles, not deploy blockers — nothing in this document should be
read as "the current deployment is unsafe."

## Next-cycle action list (concrete, bounded, not vague)

1. Director: author `balance-sheet.md#band-overrides` entry for this PvE
   genre's win-rate band (closes half of G2).
2. Designer/QA: author RPG-layer TTK target, re-measure (closes other
   half of G2).
3. Designer: `wardenProgress: null` isolation re-run to separate base-game
   vs RPG-layer contribution to the 100% clear-rate finding (G3 follow-up,
   non-blocking).
4. QA/Programmer: either schedule a human playtest round, or build a
   scripted effect-latency capture harness extending the existing
   `tests/defense-performance-browser.cjs` pattern (closes G4's
   measurable half; immersion scoring likely still needs humans).
5. Ops/release owner: schedule and execute one live `workflow_dispatch`
   rollback test against a non-disruptive target (or explicitly accept
   this as a documented, deferred risk with owner sign-off) — closes the
   one remaining G6 gap.
6. Designer: derive a scripted repeat-rate proxy from accumulated real
   idle-return telemetry, or schedule human playtest (G7 final).
7. Designer: novelty-scorecard pass against `design/trend-survey/` (G8,
   genuinely unstarted — largest single remaining gap).

## References

`.claude/skills/game-studio-harness/references/quality-gates.md` (the
actual G1-G8 framework this document reports against — note this is the
correct framework for this repo; do not reuse the older prospective
`_workspace/20260722-*/ops/release-readiness.md` templates, which target
a different, non-existent G1-G8 mechanic set for this codebase),
`production/gate-reviews/stage{1,2,3}-review.md`,
`qa/gate-measurements.md`, `.github/workflows/static.yml`,
`ops/rollback-runbook.md`, `ops/telemetry-contract.md`.
