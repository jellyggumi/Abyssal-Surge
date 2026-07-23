# Stage2 Gate Review — Solo Warden RPG Concept, Cycle 1

run-id: `20260723-solo-warden-rpg-concept` · reviewer: game-production-director (acting QA)
Stage2 required gates: **G2, G3, G5, G7 final, G8.**

## G2 — Rules & balance numbers: **FIX (partial pass, full-protocol validation outstanding)**

- Measured (this cycle): 7-archetype × 3-seed real-simulation full-campaign sweep. Max cross-archetype efficiency deviation 1.166× vs the harness's 1.3× combo-EV-cap precedent — within band.
- **Not met**: the harness's literal `win_rate_band: [0.45, 0.55]` doesn't apply to this PvE genre (documented, not a gap I can close by measuring harder — it's a genre mismatch requiring a `balance-sheet.md#band-overrides` entry, which is a designer/director decision, not a QA measurement). TTK-vs-authored-target validation for the RPG layer specifically is unmeasured (no `ttk_target_s` exists yet for RPG-modified combat). 100%-mechanics-covered-in-balance-sheet audit not run.
- Evidence: `qa/gate-measurements.md#g2`, `qa/evidence/sweep-*.json` (6 files), `scripts/run-g2-archetype-rotation.mjs`.
- **Verdict: FIX.** Two concrete actions: (1) director/designer decision to formally override `win_rate_band` for this genre in `balance-sheet.md#band-overrides` per the harness's own override mechanism (not a QA task), (2) author an RPG-layer TTK target and re-measure against it.

## G3 — Player-type diversity: **PASS, with a FINDING flagged to designer**

- Threshold: ≥3 archetypes independently viable, no archetype >50% dominance, ≥5 archetypes tested. **Met**: 7/7 archetypes tested (exceeds the ≥5 floor), all viable, no dominance (max 1.166× spread).
- **PRED-08 resolved with high confidence**: `single-companion-main` is the measurably worst-performing archetype of all 7 — the Kingshot formation-diversity axis has real mechanical teeth, not decorative.
- FINDING (not a gate blocker, a genuine balance signal): 100% full-campaign clear rate across every archetype/seed suggests the 10-stage difficulty curve may be undertuned relative to available RPG power. Recommend designer re-run with `wardenProgress: null` to isolate base-game vs RPG-layer contribution before the next balance pass.
- Evidence: `qa/gate-measurements.md#g3`.
- **Verdict: PASS.** The finding is real but doesn't block G3's own threshold — it's forwarded as input to the next design iteration, not a re-measurement requirement for this gate.

## G5 — Revenue-balance synergy: **N/A**

- No monetization exists in this project (explicit no-commerce boundary). Gate doesn't apply.
- Evidence: `qa/gate-measurements.md#g5`.
- **Verdict: N/A**, carried forward as-is — not a pass, not a fail, structurally out of scope.

## G7 final — Core loop, full validation: **FIX (repeat-rate proxy unmeasured)**

- Threshold: everything from G7-draft PLUS `repeat_rate_proxy_target: 0.70` (testers voluntarily re-enter the loop).
- Measured: loop is modeled AND implemented (carried from G7-draft, `qa/gate-measurements.md#g7`), now with live-fire evidence (Boss Rally Window, formation targeting, DOWNED-state all confirmed firing in driven runs).
- **Not measured**: repeat-rate proxy requires actual playtest sessions (human or a scripted "would-replay" heuristic) — genuinely not derivable from the archetype-completion sweep, which measures campaign-clear capability, not player *desire* to replay.
- Evidence: `qa/gate-measurements.md#g7`.
- **Verdict: FIX.** Real remaining work: either a human playtest round or a defensible scripted proxy (e.g., session-return-rate from the existing idle-return telemetry, once accumulated over real usage) — not fabricable from this cycle's simulation-only tooling.

## G8 — Novelty/striking element: **PENDING (not attempted this cycle)**

- Threshold: ≥1 element in ≤2-of-≥5 surveyed comparable titles AND QA impression score ≥4/5.
- Not measured: requires the designer's novelty-scorecard cross-referenced against `design/trend-survey/` frequency data — a Stage1-concept-phase artifact class this implementation cycle didn't touch (implementation work ≠ novelty-survey work).
- Evidence: `qa/gate-measurements.md#g8`.
- **Verdict: PENDING.** Genuinely unstarted, not silently skipped. Real Stage2 follow-up: designer scores the shipped formation/rally/trait-choice systems against the existing survey data (`design/trend-survey/`, Whiteout Survival's "shared level pool" was flagged as a novelty candidate in that survey — worth checking if this cycle's implementation created anything comparable).

## Overall Stage2 verdict: **FIX (2 of 5 gates need scoped follow-up; 1 PASS, 1 N/A, 1 genuinely unstarted)**

This is an honest partial-Stage2 position, not a forced pass. Real, measured evidence exists for every gate (no placeholder numbers), and every open item has a concrete, bounded next action — none require restarting Stage1 or Stage2 work, all are additive follow-ups.

## R1/R3/R5 governance — supplementary (not a formal Stage2 gate, but load-bearing for G2/G3's validity per UNIFIED-GDD.md §9.1)

- R3: PASS (see G2 above).
- R1: PENDING full-protocol measurement (`qa/gate-measurements.md`'s R1 section) — isolated stress-test shows a real effect but not the literal all-10-stages/realistic-loadout protocol.
- R5: unreachable-by-construction within this campaign's current 10-stage/no-NG+ scope — not violated, but also not meaningfully "passed" since the ceiling can't be approached without New Game Plus (undecided scope per `UNIFIED-GDD.md` §12 item 6).
