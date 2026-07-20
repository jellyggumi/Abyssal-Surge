# Gate Measurements — Stage 2 and Stage 3 Numeric Adjudication

```yaml
run_id: "20260718-strategy-control-depth"
measurement_date: "2026-07-19"
repository_root: "/Users/jangyoung/orca/Abyssal-Surge"
rules_version: "abyssal-surge-rules-v7"
save_schema_version: 5
focused_test_suites_run: 11 (314/314 passing)
test_breakdown: "campaign-state 42, app-command-feedback 76, command-queue-realtime 7, combat-systems 12, stage-navigation 7, battle-realtime-three 78, battle-visualizer 37, object-feedback-layer 9, release-closure 32, abyssal-command-assets 6, resource-refinement-assets 8"
overall_evidence_status: "Partial G2/G3 automated gate data and G6 source/fuzz implementation evidence recorded; every G1-G8 gate remains FIX; Pages deployment is a separate Release artifact"
balance_evidence_source: "qa/balance-v7.json (contractProbes Echo Domain)"
```

---

## Executive measurement summary

| Gate | Canonical definition | Measured value | Method | Verdict | Blocker |
|---|---|---|---|---|---|
| **G1** | 0 unwaived lore violations; 100% of shipped strings, effects, and scenarios trace to `design/worldview.md` | lore-violation audit: **NOT RUN**; shipped-content trace coverage: **NOT RUN** | intended: QA audit over every player-visible content item with designer sign-off | **FIX** | Produce the complete trace matrix and waiver list |
| **G2** | mechanics coverage 100%; matchup win rates 45–55%; TTK within ±15% of target; no combo pair above 1.30× median EV | mechanics **100%**; casual archetype **51% measured v7**; combo EV **1.1559×**; fuzz **1000×150 zero findings**; full matchup/TTK matrix **NOT RUN** | simulator v7; balance-v7.json casual 200-trial archetype | **FIX** | Complete the matchup/TTK matrix with reproducible v7 runs |
| **G3** | ≥5 archetypes; ≥3 viable 45–55%; no archetype >50% dominance | **5 archetypes defined**; optimal **100% FAILS** dominance (>50%); viable **only casual 51%** (not ≥3) | balance-v7.json archetype sweep | **FIX** | Dominance must drop ≤50%; establish ≥3 viable 45–55% |
| **G4** | median immersion score ≥4.0/5; effect-feedback latency ≤100ms in spot checks; 0 unresolved S1/S2 readability complaints | immersion score: **NOT RUN**; latency spot checks: **NOT RUN**; readability complaint audit: **NOT RUN** | intended: structured QA playtest + latency probes + severity-ledger audit | **FIX** | Measure all three canonical thresholds |
| **G5** | Revenue balance: paid/free win-rate delta ≤5%p at equal skill; comeback instant-reversal probability ≤30% per activation with cap/cooldown; free-path parity within the declared 10–20-session band; every revenue point has a signed negotiation-record entry | paid/free delta: **NOT RUN**; instant-reversal probability: **NOT RUN**; free-path session parity: **NOT RUN**; signed revenue-point audit: **NOT RUN** | intended: fairness simulations + PM/designer negotiation-record audit | **FIX** | Measure all four canonical thresholds and retain signed evidence |
| **G6** | telemetry contract implemented; rollback runbook tested once; release-readiness checklist 100%; p95 frame ≤16.7ms; long-frame rate <0.5%; memory stable over a 30-minute soak; input latency ≤100ms | source camera/fixed-step/pointer work verified; fuzz **1000×150 zero findings, double-run TRUE**; telemetry emission audit, rollback drill, readiness checklist, frame distribution, long-frame rate, soak, and input latency: **NOT RUN** | source audit + 314/314 focused tests + simulator; required operator/performance measurements absent | **FIX** | Execute every canonical operations and performance measurement |
| **G7** | ≥1 modeled loop lasting 30–180s with ≥3 actions, ≥1 reward event, and voluntary re-entry ≥70% | model: **ACCEPTED**; per-stage actions: **8–12 range**; encounter events: **per-stage distribution**; browser timing/re-entry: **NOT RUN** | designer ledger + balance-v7.json g7Proxy | **FIX** | Timed playtests and voluntary re-entry ≥70%; decision/action traces |
| **G8** | ≥5 titles; candidate frequency ≤2; QA impression ≥4/5 | titles: **6 surveyed**; frequency: **0/6 PASS**; designer: **23/30**; QA impression: **NOT RUN** | trend survey + designer evaluation | **FIX** | QA impression ≥4.0/5.0 |

---

## Release artifact (separate from gate G1)

**GitHub Pages deployment:** https://jellyggumi.github.io/Abyssal-Surge/ (action 29691371525, success 2026-07-19T14:43:25Z)
- **Build:** v51 (6/6 GLBs ready, 23 audio/video clips ready)
- **Smoke test:** Hunt 0/2→1/2 playable, feedback 980px visible
- **Status:** LIVE, deployable independent of Stage 2/3 numeric gates

This is Release closure evidence, not G1 narrative/worldview consistency.

---

## G1 — Narrative and worldview consistency

### Canonical requirement
- 0 unwaived lore violations.
- 100% of shipped strings, effects, and scenarios trace to `design/worldview.md`.
- QA audit over all player-visible content, with explicit waiver records and designer sign-off.

### Current measurement
**NOT RUN** — No shipped-content trace audit performed. No worldview consistency review. No designer narrative sign-off.

### Missing evidence
- Complete stage-by-stage narrative trace (dialogue, encounter framing, character arc progression)
- Thematic alignment audit (visual motifs, audio cues, narrative beats per stage)
- Lore consistency check (no worldview breaking changes; backstory coherence)
- Designer/director narrative sign-off

**Verdict:** `FIX`

---

## G2 — Rules and balance

### Measured data

**Casual archetype (v7, 200 trials)**
```
winRatePct: 51
Verdict: 51 ∈ [45, 55] → PASS
```

**Greedy-economy and Optimal**
```
greedy-economy: 100%
optimal: 100%
```

**Reward combo coverage**
```
Pairs: 12/12 (100%)
Max ratio: 1.1559×
Verdict: ≤1.30 → PASS
```

**Determinism support (not a G2 or G6 gate criterion)**
```
Operations: 150,000 total
Findings: 0
Double-run: TRUE
Result: zero findings; supportive implementation evidence only
```

### Missing measurements
- Matchup win bands (all combos, all stages)
- TTK matrix per archetype and stage

**Verdict:** `FIX`

---

## G3 — Player-type diversity

### Measured archetypes

```
rusher:         0%
greedy-economy: 100%
optimal:        100%
comeback:       0%
casual:         51%
```

### Criterion check

- **Count:** 5 defined → PASS (≥5 required)
- **Dominance:** optimal 100% **> 50% threshold → FAILS**
- **Viable band:** only casual 51% qualifies (need ≥3 in 45–55%)

**Verdict:** `FIX`

---

## G4 — Immersion

### Canonical requirement
- Median structured-playtest immersion score ≥4.0/5 across scored scenes.
- Effect-feedback latency ≤100ms in spot checks.
- 0 unresolved S1/S2 readability complaints.

### Current measurement
**NOT RUN** — No structured immersion score, latency spot-check packet, or S1/S2 readability-complaint audit was completed.

### Missing evidence
- Scored scene packet with median immersion result.
- Timestamped effect-feedback latency spot checks.
- Severity ledger showing zero unresolved S1/S2 readability complaints.

**Verdict:** `FIX`

### Battlefield intelligence implementation evidence (2026-07-19)

- Focused command: `node --test tests/battle-field-command-overlay.test.mjs tests/battle-realtime-three.test.mjs tests/battle-visualizer.test.mjs`
- Observed result: **141/141 passing**, 0 failed.
- Fresh local Chromium probe at 390×844 CSS px: WebGL canvas visible at 352×256; the 336 px tactical readout stayed inside the 366 px battlefield; the live status used `overflow: hidden` and `text-overflow: ellipsis`.
- Durable evidence: `qa/evidence/battlefield-intelligence/summary.json` and `qa/evidence/battlefield-intelligence/mobile-390x844.webp`.
- Scope: source-level selection-affordance, tactical-readout, responsive-containment, and renderer-lifecycle evidence only. The canonical structured immersion score, ≤100 ms feedback-latency sample, and S1/S2 complaint-closure audit remain **NOT RUN**.

**Focused implementation verdict:** `PASS-FOR-IMPLEMENTATION`  
**Canonical G4 verdict:** `FIX` (unchanged)

---

## G5 — Revenue balance and fairness

### Canonical requirement
- **Paid/free delta:** win-rate difference ≤5%p at equal skill.
- **Comeback reversal:** instant-reversal probability ≤30% per activation with a recorded cap and cooldown.
- **Free-path parity:** progression reaches parity within the declared 10–20-session band.
- **Signed records:** every revenue point has a PM/designer-signed negotiation-record entry.

### Current measurement
**NOT RUN** — No equal-skill paid/free delta, instant-reversal probability, free-path session-parity result, or complete signed revenue-point audit was measured.

### Missing evidence
- Equal-skill paid/free win-rate delta with a ≤5%p threshold.
- Per-activation instant-reversal probability with cap and cooldown evidence.
- Free-path progression measurement across the declared 10–20-session band.
- Signed PM/designer negotiation record for every revenue point.

**Verdict:** `FIX`

---

## G6 — Runtime and performance

### Source implementation (verified)

**Frame-independent camera**
- Location: `battle-realtime-three.js:1509-1513`
- Formula: `α = 1 - exp(-dt / 0.1304)`
- Verification: 78/78 battle-realtime tests passing
- Verdict: `PASS-FOR-IMPLEMENTATION`

**Fixed-step simulation**
- Location: `battle-realtime-three.js:966-993`
- Step: 1/60s; clamp 0.10s; catch-up max 6
- Verification: tests pass
- Verdict: `PASS-FOR-IMPLEMENTATION`

**Pointer safety**
- Location: `battle-visualizer.js:228-232, 837-932`
- Contract: activePointerId, deduplication, lostpointercapture
- Verification: 76/76 app tests pass
- Verdict: `PASS-FOR-IMPLEMENTATION`

**Deterministic save**
- Fuzz: 1,000×150 ops = 150,000 total
- Findings: 0
- Double-run: TRUE
- Verdict: `PASS-FOR-IMPLEMENTATION`

### Missing measurements
- `ops/telemetry-contract.md` implementation audit covering all required emitted fields.
- One recorded `ops/rollback-runbook.md` drill.
- `ops/release-readiness.md` checklist at 100%.
- Frame distribution proving p95 ≤16.7ms and long-frame rate <0.5%.
- Stable memory over a 30-minute soak.
- Input-latency measurement proving ≤100ms.

**Verdict:** `FIX` — source/fuzz implementation evidence is positive; every canonical operations/performance threshold remains NOT RUN

---

## G7 — Core loop

### Designer model (accepted)
All stages 30–180s; S1–S10 60–90 through 120–165s → **PASS**

### Per-stage data (g7Proxy)
Actions: 8–12 range across archetypes → **PASS**
Encounter events: per-stage distribution (rusher 6/0/0/0/0/0/0/0/0/0; greedy 8/6/10/10/10/10/10/10/10/10) → **PASS**

### Missing measurements
- Browser session timing (≥5 per stage)
- Voluntary re-entry ≥70%

**Verdict:** `FIX`

---

## G8 — Striking element

### Measured data
- Comparable titles: 6 surveyed
- Undertow Reversal frequency: 0/6 ≤ 2 → **PASS**
- Designer score: 23/30

### Missing measurement
- QA impression ≥4/5.

**Verdict:** `FIX`

---

## Linked evidence

- Simulator: `qa/balance-v7.json`
- Source: `campaign-state.js:1`, `battle-realtime-three.js:1509-1513,966-993`, `battle-visualizer.js:228-232,837-932`
- Tests: 314/314 focused (11 suites)
- Design: `design/core-loop.md`, `design/novelty-scorecard.md`
- Release: https://jellyggumi.github.io/Abyssal-Surge/ (Pages live, v51)

