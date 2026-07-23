# Stage1 Gate Review — Solo Warden RPG Concept, Cycle 1

run-id: `20260723-solo-warden-rpg-concept` · reviewer: game-production-director (acting; no separate QA agent spawned this cycle — director performed measurement directly, evidence trail preserved for audit)
Stage1 required gates (per `references/quality-gates.md` stage→gate mapping): **G7 draft, G1 draft, G6-ops draft.**

## G7 — Core loop, ≥1 mandatory: **PASS (draft)**

- Threshold: ≥1 loop in `design/core-loop.md` with numeric model (period 30-180s, ≥3 actions/loop, ≥1 reward event/loop) + playtest repeat-rate proxy ≥70%.
- Measured: `vanguard-circuit` model exists (period_s=60, actions_per_loop=4, reward_events_per_loop=2) — carried from Stage1-concept phase, unchanged. This cycle adds real implementation evidence the concept-phase draft didn't have: the `formation-assault` nested-secondary loop (elite/boss encounters) is now live in simulation, not just modeled — verified via driven-run event-stream inspection (`COMPANION_DAMAGED`, `COMPANION_DOWNED`, `BOSS_RALLY_WINDOW` events fire correctly, confirmed in `qa/gate-measurements.md#g7`).
- repeat_rate_proxy (≥70%): **PENDING** — requires human/scripted playtest sessions, not derivable from the archetype sweep alone. Not blocking Stage1-draft (only required at G7-final, Stage2).
- Evidence: `qa/gate-measurements.md#g7`, `_workspace/.../design/UNIFIED-GDD.md` §2.3.
- Verdict rationale: draft-level threshold is "loop modeled + implemented" — both true. Full G7-final (repeat-rate proxy) deferred to Stage2 per the gate table, not a Stage1 blocker.

## G1 — Narrative consistency: **PASS (draft)**

- Threshold: 0 un-waived lore violations; shipped content traces to `design/worldview.md`.
- Measured: 0 violations found across every new string/mechanic-label added this implementation pass. All 5 new proper nouns pre-verified against 3 primary sources in the Stage1-concept phase (unchanged this cycle); this cycle's new UI/mechanic copy (Warden stat/skill/trait/role names+descriptions) traces cleanly to `UNIFIED-GDD.md` §1.2/§3.2/§3.3.
- Evidence: `qa/gate-measurements.md#g1`.
- Verdict rationale: Stage1-draft threshold ("worldview locked, content-so-far consistent") is met. Full 100%-audit-of-all-player-visible-content is Stage3-final scope.

## G6-ops — Telemetry/resource manifest: **PASS (draft) — FIX closed same-cycle**

- Threshold (Stage1-draft): telemetry contract + resource manifest exist.
- Initially measured: **not met.** All 5 new RPG-layer events (`COMPANION_DAMAGED`, `COMPANION_DOWNED`, `BOSS_RALLY_WINDOW`, `WARDENS_WARD_TRIGGERED`, `ECHO_WARDEN_AWAKENING_TRIGGERED`) existed in the simulation's event stream but weren't wired into `defense-telemetry.js`'s `SIMULATION_FIELDS` schema.
- FIX applied: added the 4 missing payload fields (`bossId`, `cooldownReductionBp`, `owner`, `shield`) to the allowlist, bumped `TELEMETRY_SCHEMA_VERSION` 1→2. Verified via direct telemetry-capture smoke test (driven run, real `COMPANION_DAMAGED`/`COMPANION_DOWNED` records with full payload) and full re-pass of `tests/defense-observers-contract.test.mjs` (9/9, zero regression to the pre-existing contract).
- Evidence: `qa/gate-measurements.md#g6-ops`.
- **Verdict: PASS (draft).** The gap found during review was scoped to one file, additive-only, and closed within this same review pass — no outstanding action for the task manifest.

## Overall Stage1 verdict: **PASS (draft) — all 3 required gates clear; the one FIX identified during review (G6-ops) was closed in the same pass, not deferred**

## Supplementary evidence (not required for Stage1, gathered opportunistically this cycle since the archetype-sweep infrastructure was built anyway)

Stage2-gate preview measurements are already in `qa/gate-measurements.md` (#g2, #g3, R1/R3/R5, PRED-05/08/09) — real simulation-driven data, not placeholders, though explicitly marked PARTIAL/PENDING where full-protocol measurement remains outstanding. This gives Stage2 entry a running start rather than a cold start.
