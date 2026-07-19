# Stage 2 Gate Review — G2/G3/G5/G7/G8 Adjudication (D3)

```yaml
run_id: "20260718-strategy-control-depth"
review_date: "2026-07-19"
review_type: "Stage 2 implementation-entry gate adjudication (D3)"
overall_verdict: MULTIPLE FIX
stage_2_exit: BLOCKED
production_implementation: AUTHORIZED_WITH_ORDER_AND_BOUNDS
qa_measurement_source: "_workspace/20260718-strategy-control-depth/qa/gate-measurements.md"
```

---

## Stage 2 gate verdicts (G2/G3/G5/G7/G8)

| Gate | Canonical definition | Measured | Verdict | Blocker |
|---|---|---|---|---|
| **G2** | mechanics coverage 100%; matchup win rates 45–55%; TTK within ±15%; combo EV ≤1.30× median | mechanics **100%**; casual archetype **51%**; combo **1.1559×**; fuzz **zero findings**; full matchup/TTK matrix **NOT RUN** | **FIX** | Complete the reproducible v7 matchup/TTK matrix |
| **G3** | ≥5 archetypes; ≥3 viable 45–55%; no >50% dominance | **5 defined**; optimal **100% FAILS** (>50%); viable **only casual 51%** | **FIX** | Dominance ≤50%; ≥3 viable 45–55% |
| **G5** | paid/free win-rate delta ≤5%p at equal skill; instant-reversal probability ≤30% per activation with cap/cooldown; free-path parity in the declared 10–20-session band; every revenue point signed | all four measurements **NOT RUN**; the existing no-paid-power/source-cap guard is implementation context only | **FIX** | Run fairness simulations and retain a complete signed negotiation-record audit |
| **G7** | ≥1 modeled loop lasting 30–180s with ≥3 actions, ≥1 reward, and voluntary re-entry ≥70% | model **ACCEPTED**; actions **8–12 range**; encounter events **per-stage distribution**; timed playtests/re-entry **NOT RUN** | **FIX** | Timed playtests and voluntary re-entry ≥70% |
| **G8** | ≥5 titles; frequency ≤2; QA impression ≥4/5 | titles **6**; frequency **0/6 PASS**; designer **23/30**; QA impression **NOT RUN** | **FIX** | QA impression ≥4.0/5.0 |

---

## Evidence status

- **G2 casual archetype sample:** 51% over 200 v7 trials is inside the target band; it is not the required full matchup matrix.
- **G2 combo EV subcriterion:** 1.1559× ≤ 1.30 — PASS.
- **Determinism support:** 1000×150 operations produced zero findings and the double run matched; this does not adjudicate G2 or G6.
- **G3 archetypes:** 5 defined; optimal 100% exceeds 50% threshold — FAILS dominance
- **G5:** No paid/free economics evidence — FIX
- **G7 model:** Designer targets accepted; v7 data consistent; browser sessions outstanding
- **G8 frequency:** 0/6 ≤ 2 threshold — PASS subcriterion

---

## Stage 2 exit requirements

**Blocked by:**
- G2 matchup/TTK measurement
- G3 dominance fix (optimal >50%)
- G5 revenue-balance audit (no paid/free delta, reversal, sessions, signatures)
- G7 browser/session timing
- G8 QA impression
- Zero open S1 defects

**No Stage 2 exit verdict issued.** Production may continue under SD-018/SD-020/SD-021 bounds. Stage 3 entry requires D3 PASS on all above.

---

## Linked artifacts

- `qa/gate-measurements.md` — full G2-G8 verdicts
- `qa/balance-v7.json` — simulator data
- `production/decision-log.md` SD-020/SD-021
- `production/task-manifest.md`
- Tests: 314/314 focused (11 suites)
