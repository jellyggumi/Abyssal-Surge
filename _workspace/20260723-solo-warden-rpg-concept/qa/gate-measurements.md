# Gate Measurements — Solo Warden RPG Concept, Cycle 1

run-id: `20260723-solo-warden-rpg-concept` · measured by: director (acting QA, this cycle — no separate QA agent spawned)
Every measurement below names the exact command/session that produced it. Numbers not yet measured are marked PENDING, not silently omitted.

## #g1 — Narrative consistency

**Status: DRAFT PASS** (Stage1 requirement is draft-level; full audit deferred to Stage3 per `references/quality-gates.md` stage→gate mapping).

- Measured: 0 shipped strings/mechanics reference non-canonical proper nouns. All 5 new proper nouns (Warden Corps, Ration Sigil, Deepmark, Farwatch Hold, Undertow) verified against 3 primary sources with zero name/number reuse (`design/lane-worldview.md` §5, carried into `UNIFIED-GDD.md` §1.2 — pre-existing artifact from this run's Stage1 concept phase, unchanged by this implementation pass).
- Method: manual audit of every new UI string, event name, and mechanic label added in this implementation pass (`rpg-catalog.js` WARDEN_STATS/WARDEN_SKILL_TREE/WARDEN_TRAITS/COMPANION_ROLES names+descriptions, `app.js` growth-panel copy) against `design/worldview.md`.
- Evidence: this file; source strings in `rpg-catalog.js` (Korean names/descriptions for every stat/skill/trait/role) trace to §1.2/§3.2/§3.3 of `UNIFIED-GDD.md`.
- Blocking: none for Stage1 draft. Full G1-final audit (100% of shipped player-visible content, `qa/gate-measurements.md#g1` re-run) is Stage3 scope.

## #g2 — Rules & balance numbers (Stage2 gate; measured early as available evidence)

**Status: PARTIAL — genre-adapted methodology documented, full band validation PENDING.**

This is a PvE idle-combat campaign (not PvP matchups) — the harness default `win_rate_band: [0.45, 0.55]` is a PvP-shaped threshold that doesn't map directly onto single-player campaign clears. Measured instead: efficiency-spread (boss TTK ticks) across the full archetype-rotation dataset, using the harness's own `combo_ev_cap_vs_median: 1.3` precedent as the cross-archetype tolerance band.

- Measured: 7-archetype × 3-seed (301/302/303) full 10-stage campaign sweep, real simulation-driven (not measurement-profile fixtures). All 21 runs completed the full campaign (100% clear rate — see `#g3` for the finding this raises). Boss TTK ticks by archetype (avg of 3 seeds):

| archetype | avg boss TTK (ticks) | ratio vs median (673) |
|---|---|---|
| rusher | 545 | 0.81 |
| micro-optimizer | 609 | 0.905 |
| casual | 627 | 0.932 |
| completionist-collector | 673 | 1.000 |
| turtle | 738 | 1.097 |
| economy-greed | 757 | 1.125 |
| single-companion-main | 785 | 1.166 |

- Max deviation from median: 1.166× — **within** the 1.3× combo-EV-cap precedent. No archetype combination breaks the tolerance band.
- Method: `node scripts/run-g2-archetype-rotation.mjs <archetypeId> --output <path>` for economy-greed/micro-optimizer/casual/completionist-collector/single-companion-main; equivalent eval-cell run for rusher/turtle (same policy logic, promoted into the script). Script committed at `scripts/run-g2-archetype-rotation.mjs`, sibling to the existing `scripts/run-g2-archetype-sweep.mjs`.
- Evidence: raw per-seed JSONL committed at `qa/evidence/sweep-{rusher-turtle,economy-greed,micro-optimizer,casual,completionist-collector,single-companion-main}.json` (6 files, this run-id's workspace — durable, not ephemeral `/tmp`).
- PENDING for full G2 pass: TTK-vs-authored-target validation (this measures cross-archetype *spread*, not absolute TTK against `balance-sheet.md`'s `ttk_target_s`/`ttk_tolerance` — that target doesn't yet exist for the RPG layer specifically, only for the pre-existing base combat in `defense-catalog.js`). 100% mechanics-covered-in-balance-sheet audit not yet run.

## #g3 — Player-type diversity

**Status: PASS on the diversity-value question (PRED-08); FINDING on completion-rate ceiling.**

- **PRED-08 (highest severity — Kingshot axis decorative-or-real)**: measured, not decorative. `single-companion-main` is the **slowest** (worst) of all 7 archetypes (785 vs 545-757 ticks for diversified builds) — companion formation diversity has real, measurable mechanical value. Diversified archetypes cluster faster; the single-companion control group is unambiguously, consistently disadvantaged across all 3 seeds.
  - Evidence: same sweep dataset as #g2.
- **≥3 archetypes independently viable**: 7/7 archetypes completed 100% of a full 10-stage campaign across all 3 seeds — technically all 7 are "viable" by the completion metric, but see the finding below.
- **No archetype >50% dominance**: cannot be measured by the harness's default framing (dominance requires a contested win/loss distribution; this genre has no PvP win/loss to dominate). Efficiency-spread (above) is the adapted proxy and shows no runaway dominance (max 1.166× median).
- **FINDING (report to designer, not a gate failure)**: 100% full-campaign clear rate across every archetype and every seed suggests the current 10-stage difficulty curve may be undertuned relative to the RPG layer's power budget — even the `casual` archetype (30% skip-rate on investment decisions, effectively simulating low engagement) cleared every stage on the first attempt, every seed. This is worth a designer pass in Stage2: either the base game's existing difficulty (unchanged by this cycle) was already this permissive, or the RPG layer's additive power (even partial/low investment) tips stages that were previously closer to the 45-55% band. Recommend: re-run this exact sweep with `wardenProgress: null` (RPG-inactive baseline) to isolate whether this is a pre-existing base-game characteristic or an RPG-layer regression.

## #g5 — Revenue-balance synergy

**Status: N/A this cycle.** No monetization exists in this project (explicit no-commerce boundary, `UNIFIED-GDD.md` §0/§7). The harness's G5 gate (paid/free delta, comeback mechanics) doesn't apply. §7 of `UNIFIED-GDD.md` already reinterprets G5's underlying concepts as engagement-point/skill-reversal-moment language for this exact reason. Marking N/A rather than PASS to avoid implying a check ran.

## #g6-ops — Telemetry / resource manifest (Stage1 draft requirement)

**Status: PASS (draft) — FIX closed.** Initially found PENDING (5 new RPG-layer event types existed in the simulation's event stream but weren't wired into `defense-telemetry.js`'s schema). Closed same-cycle: added `bossId`/`cooldownReductionBp`/`owner`/`shield` to `SIMULATION_FIELDS`, bumped `TELEMETRY_SCHEMA_VERSION` 1→2 (real additive schema change). All 5 new event types now captured with full payload: `BOSS_RALLY_WINDOW`, `WARDENS_WARD_TRIGGERED`, `ECHO_WARDEN_AWAKENING_TRIGGERED`, `COMPANION_DAMAGED`, `COMPANION_DOWNED`.
- Verified via direct telemetry-capture smoke test (driven `gate-zenith` run, `veil-vanguard` FRONT to DOWNED) — `COMPANION_DAMAGED`/`COMPANION_DOWNED` records confirmed present with correct payload fields (`entityId`, `companionId`, `damage`, `hp`, `maxHp`, `policyId`).
- `tests/defense-observers-contract.test.mjs` (9/9 pass) confirms no regression to the pre-existing telemetry contract.

## #g7 — Core loop (Stage1 draft requirement)

**Status: DRAFT PASS**, carried from Stage1 concept phase (`UNIFIED-GDD.md` §2.3 `vanguard-circuit` model), now with real implementation evidence added:
- The core loop's `formation-assault` nested-secondary loop (elite/boss encounters) is now real, not just modeled: Boss Rally Window (`BOSS_RALLY_WINDOW` event), FRONT/BACK formation targeting, and DOWNED-state consumption all fire in live simulation (verified via driven-run event-stream inspection during implementation, see decision-log entries).
- `repeat_rate_proxy_target: 0.70`: PENDING — requires actual playtest sessions (human or scripted "would-replay" heuristic), not measurable from the archetype sweep alone.

## #g8 — Novelty/striking element (Stage2 gate)

**Status: PENDING.** Not measured this cycle — requires the designer's novelty-scorecard vs the trend-survey frequency table (`design/trend-survey/`), which is Stage1-concept-phase artifact, unchanged by this implementation pass. No new novelty claim added or verified in this cycle.

---

## R1/R3/R5 total-permanent-power-governance (UNIFIED-GDD.md §9.1) — supplementary measurements

- **R3 (combo dominance ≤1.3×)**: see #g2 above — 1.166× max, PASS.
- **R1 (Warden raw-stat ceiling ≤20% of stage power budget)**: measured via an isolated stress-test (zero-companion `gate-zenith`, skill-offer policy held identical across both arms), not the full per-stage protocol the spec describes. Maxed Warden stats alone shift win rate 0/5→3/5 seeds on the hardest stage in a degenerate (companion-free) build — real effect size, but this measures a build nobody would actually play (companions are free), not the literal "stat-only contribution across all 10 stages with realistic loadouts" protocol. **PENDING full-protocol measurement** — flagged, not force-verdicted.
- **R5 (session growth ≤1.6× by session 15)**: **not reachable within this campaign's structure as currently scoped.** A full campaign is 10 stages/sessions; even a maxed single-stat build only reaches ~1.133× cumulative power by session 10 (well under the 1.6× ceiling), and session 15 requires New Game Plus, which `UNIFIED-GDD.md` §12 item 6 explicitly lists as undecided/out-of-scope this cycle. R5 is un-violated by construction, not because it was verified — this needs revisiting once NG+ scope is decided.

## PRED-09 (companions-wardpact / free-tank exploit mitigation)

**Status: mitigation mechanism confirmed functional, full resolution still open per the source doc's own framing.**
- Measured: T1-ward vs T5-ward `veil-vanguard` (FRONT, `gate-zenith`, 5 seeds each): T1 went DOWNED in 3/5 seeds within a 20,000-tick budget; T5 never went DOWNED in any of the 5 seeds. Ward-tier investment produces a large, real survival difference.
- This confirms the `formationIntegrity = damage × 8 × wardTierMultiplier` lever works as designed (balance-sheet.md's worked example: 3360 at T1 vs 6720 at T5).
- NOT yet resolved (matches `UNIFIED-GDD.md` §4.4's own explicit caveat): whether a "burst damage to end the fight before the companion dies" strategy still dominates ward investment. That requires comparing full-campaign performance (clear speed, resource cost) between a ward-invested archetype and a burst-focused archetype — genuinely unmeasured this cycle, real Stage2 follow-up.
